import express from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();

// Body parser with 10MB limit
app.use(express.json({ limit: "10mb" }));

// Health check endpoints for container and Cloud Run readiness/liveness probes
app.get(["/api/health", "/health", "/healthz"], (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// AI Chat Bot endpoint for business data insights
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history, context } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: "GEMINI_API_KEY environment variable is not configured. Please define it in your Secrets panel." 
      });
    }

    // Initialize the official Google GenAI SDK
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });

    // Construct a detailed system instruction for the LLM to ground it on business data
    const systemInstruction = `You are "Mandi AI," a brilliant, highly capable, and localized Procurement AI companion for the RiceAggregator Procurement Portal (operated by Tejas Canvassing).
Your goal is to answer client, trade, financial, and logistics-related analytics questions instantly and accurately, based purely on live business datasets provided in your data context.

=== INSTRUCTIONS & STRATEGY ===
1. **Pending Payments Queries**:
   - Look at the "arrivals" list. Each arrival row represents a cargo shipment with dynamic values.
   - If "noOfDayRec" is "Not Cleared" or "noOfDayRec" does not equal "Cleared", that shipment's payment is outstanding/pending!
   - Under "arrivals", "partyName" represents the Buyer/Client (e.g. 'V.K FOODS', 'PLATINUM TRADERS'). "netAmt" or "amount" is the outstanding amount.
   - Summarize the ledger records to say which Buyers/Clients have outstanding payments, what is their exact balance sum, and print a clear list sorted by balance size.
   - Example clients from seed data: 'V.K FOODS', 'PLATINUM TRADERS', 'POPULAR TRADERS', etc.

2. **Quantity Pending to be Loaded (Contracts & Placed Orders)**:
   - Look at the "orders" list. Each order represents a contract agreement.
   - When an order's status is "Placed" or "Confirmed", it means the cargo is active but hasn't arrived/finished loading at destination yet! (Only status === "Arrived" means it is loaded and delivered).
   - Compute the sum of "qty" (quintals - QTLS) for the matching "buyer" or client where status is not "Arrived" yet.
   - For example, if they ask: "For a certain client how much quantity is pending to be loaded?", find their orders with status !== "Arrived", aggregate the quantities, and summarize clearly.

3. **General Business Search**:
   - You have access to detailed arrivals, orders, and ledger information. Answer queries about millers (suppliers), brands (e.g., 'Royal Heritage', 'Golden Grains'), locations (e.g., 'Amritsar', 'Patiala'), or general volumes.
   - Keep answers objective, highly technical, yet clean and friendly.
   - NEVER invent/simulate data outside of the provided context. If a client is not found, respectfully say: "I couldn't find active matching records for that client, but here are the clients listed in our current base..."

4. **Formatting**:
   - Always format currency sums nicely in Indian Rupees (use ₹ and standard format like ₹ 8,70,000).
   - Express grain quantities with the suffix QTLS (Quintals) (e.g., 220 QTLS).
   - Use scannable markdown bullet lists and bold text highlights for high readability.

=== ACTIVE BUSINESS DATA CONTEXT ===
- Physical Arrivals (Spreadsheet): ${JSON.stringify(context?.arrivals || [])}
- Placed Orders (Contracts): ${JSON.stringify(context?.orders || [])}
- Ledger Accounts: ${JSON.stringify(context?.ledgers || [])}
==================================
Current Date/Time: ${new Date().toISOString()}
User Identity: ${context?.userEmail || "Authorized Staff Member"}
User Role Context: ${context?.userRole || "Administrator / Broker"}

Write a polite, precise, and professional response that solves the user's specific request using the live context.`;

    // Structure chat messages
    const contents = [];
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.text || msg.content }]
        });
      }
    }
    contents.push({
      role: "user",
      parts: [{ text: message }]
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.15,
      }
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini API Error in Express router /api/chat:", error);
    res.status(500).json({ error: error.message || "Failed to generate AI insights." });
  }
});

// In-memory log of recent dispatches for live verification
interface DispatchLogItem {
  id: string;
  type: "po_email" | "whatsapp" | "sms";
  target: string;
  recipientName?: string;
  subject?: string;
  message?: string;
  timestamp: string;
  status: "delivered_real" | "delivered_simulated" | "failed";
  details: string;
  directLink?: string;
}

const dispatchHistory: DispatchLogItem[] = [];

function recordDispatch(item: Omit<DispatchLogItem, "id" | "timestamp">) {
  const logEntry: DispatchLogItem = {
    id: `DSP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    ...item,
  };
  dispatchHistory.unshift(logEntry);
  if (dispatchHistory.length > 50) dispatchHistory.pop();
  return logEntry;
}

// REAL / SIMULATED DISPATCH ROUTER: SMTP EMAILS
app.post("/api/dispatch-po", async (req, res) => {
  try {
    const { to, supplierName, subject, htmlContent, textContent, poNumber, html, text, batchId } = req.body;

    if (!to) {
      return res.status(400).json({ error: "Recipient email ('to') is required." });
    }

    const host = process.env.SMTP_HOST || "";
    const port = parseInt(process.env.SMTP_PORT || "587");
    const user = process.env.SMTP_USER || "";
    const pass = process.env.SMTP_PASS || "";
    const from = req.body.from || process.env.SMTP_FROM || user || "procurement@tejascanvassing.com";

    const isConfigured = !!(host && user && pass);
    const poRef = poNumber || batchId || "PO";
    const finalSubject = subject || `Purchase Order ${poRef} - Tejas Canvassing`;
    const finalHtml = htmlContent || html || `<p>Purchase Order ${poRef} compiled by Tejas Canvassing</p>`;
    const finalText = textContent || text || `Official Purchase Order ${poRef} for ${supplierName || 'Supplier'}.\nPlease inspect attached purchase order documents.`;

    const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(finalSubject)}&body=${encodeURIComponent(finalText)}`;

    console.log(`[Email Dispatcher] Target: ${to} (${supplierName || "Supplier"}), Configured: ${isConfigured}`);

    if (isConfigured) {
      const nodemailer = await import("nodemailer");
      const cleanPass = pass.replace(/\s+/g, "");
      const cleanUser = user.trim();

      const transporter = host.includes("gmail")
        ? nodemailer.createTransport({
            service: "gmail",
            auth: { user: cleanUser, pass: cleanPass },
          })
        : nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: { user: cleanUser, pass: cleanPass },
          });

      const info = await transporter.sendMail({
        from: `"Tejas Canvassing" <${from}>`,
        to,
        subject: finalSubject,
        text: finalText,
        html: finalHtml,
      });

      const logged = recordDispatch({
        type: "po_email",
        target: to,
        recipientName: supplierName || "Supplier",
        subject: finalSubject,
        message: finalText,
        status: "delivered_real",
        details: `Successfully sent via SMTP relay ${host} (MessageID: ${info.messageId}).`,
        directLink: mailtoUrl,
      });

      console.log(`[Email Dispatcher] Real Email Sent! Message ID: ${info.messageId}`);
      return res.json({
        success: true,
        status: "real_success",
        isLiveSent: true,
        messageId: info.messageId,
        mailtoUrl,
        message: `Successfully transmitted PO to ${to} via SMTP ${host}.`,
        log: logged,
      });
    } else {
      // Fallback simulation mode with direct mailto client launcher
      const details = `SMTP server credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) not set in environment. Simulated dispatch recorded in backend logs; direct mailto launcher generated.`;
      const logged = recordDispatch({
        type: "po_email",
        target: to,
        recipientName: supplierName || "Supplier",
        subject: finalSubject,
        message: finalText,
        status: "delivered_simulated",
        details,
        directLink: mailtoUrl,
      });

      return res.json({
        success: true,
        status: "simulated_success",
        isLiveSent: false,
        mailtoUrl,
        message: `PO logged in dispatch gateway. Add SMTP credentials to deliver directly to inboxes.`,
        details,
        log: logged,
      });
    }
  } catch (err: any) {
    console.warn("[Email Dispatcher Warning]:", err?.message || err);
    recordDispatch({
      type: "po_email",
      target: req.body?.to || "unknown",
      recipientName: req.body?.supplierName || "Supplier",
      subject: req.body?.subject || "PO Error",
      status: "failed",
      details: err.message || "Failed to dispatch email notification.",
    });
    return res.status(500).json({ error: err.message || "Failed to dispatch email notification." });
  }
});

// Helper for formatting phone numbers to E.164 and WhatsApp format
function formatPhoneNumber(phone: string) {
  let digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) digits = digits.substring(1);
  if (digits.length === 10) {
    return { e164: `+91${digits}`, digits: `91${digits}`, national: digits };
  }
  if (digits.startsWith("91") && digits.length === 12) {
    return { e164: `+${digits}`, digits, national: digits.substring(2) };
  }
  return { e164: `+${digits}`, digits, national: digits };
}

// REAL DISPATCH ROUTER: WHATSAPP NOTIFICATIONS via Twilio
app.post("/api/dispatch-whatsapp", async (req, res) => {
  const { to, buyerName, message, contentSid, contentVariables } = req.body;

  if (!to || (!message && !contentSid)) {
    return res.status(400).json({ error: "Recipient phone number ('to') and either 'message' or 'contentSid' are required." });
  }

  const { e164, digits } = formatPhoneNumber(String(to));
  const waDirectUrl = `https://api.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(message || "")}`;

  dotenv.config({ override: true });

  const rawSid = req.body.accountSid || process.env.TWILIO_ACCOUNT_SID || "";
  const rawToken = req.body.authToken || process.env.TWILIO_AUTH_TOKEN || "";
  const rawPhone = req.body.fromSender || process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER || "+14155238886";

  const accountSid = String(rawSid).trim().replace(/^["']|["']$/g, '');
  const authToken = String(rawToken).trim().replace(/^["']|["']$/g, '');
  const twilioPhone = String(rawPhone).trim().replace(/^["']|["']$/g, '');

  console.log("[Twilio Environment Check - WhatsApp]", {
    hasAccountSid: !!accountSid,
    accountSidPrefix: accountSid ? `${accountSid.substring(0, 6)}...` : "MISSING",
    hasAuthToken: !!authToken,
    hasPhoneNumber: !!twilioPhone,
    phoneNumber: twilioPhone || "MISSING",
    nodeEnv: process.env.NODE_ENV || "development",
  });

  if (!accountSid || !authToken) {
    const missing = [
      !accountSid && "TWILIO_ACCOUNT_SID",
      !authToken && "TWILIO_AUTH_TOKEN",
    ].filter(Boolean) as string[];

    console.info(`[WhatsApp Dispatcher] Twilio credentials not configured in environment (${missing.join(", ")}). Running in fallback simulated mode with direct WhatsApp launcher.`);

    const logged = recordDispatch({
      type: "whatsapp",
      target: e164,
      recipientName: buyerName || "Buyer",
      message: message || `Template: ${contentSid}`,
      status: "delivered_simulated",
      details: `Twilio credentials (${missing.join(", ")}) not set in environment. Simulated dispatch recorded in backend logs; direct WhatsApp launcher generated.`,
      directLink: waDirectUrl,
    });

    return res.status(200).json({
      success: true,
      status: "simulated_success",
      isConfigured: false,
      isLiveSent: false,
      formattedPhone: e164,
      directUrl: waDirectUrl,
      message: `WhatsApp notification recorded. Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in environment variables to deliver directly via Twilio.`,
      missingVariables: missing,
      log: logged,
    });
  }

  // Determine WhatsApp sender:
  // In Twilio Sandbox mode, the WhatsApp sender MUST be whatsapp:+14155238886.
  // Standard trial phone numbers (e.g. +13854832560) are SMS only and will cause Twilio Error 572002 if sent as whatsapp:
  const requestedSender = req.body.fromSender || process.env.TWILIO_WHATSAPP_NUMBER;
  let senderNum = requestedSender || twilioPhone || "+14155238886";
  let cleanSender = senderNum.trim();

  if (!cleanSender.startsWith("whatsapp:")) {
    if (!requestedSender && !cleanSender.includes("4155238886")) {
      console.log(`[WhatsApp Dispatcher] Note: '${cleanSender}' is an SMS trial number. Automatically using Twilio WhatsApp Sandbox (+14155238886) to prevent Error 572002.`);
      cleanSender = "+14155238886";
    }
    cleanSender = `whatsapp:${cleanSender}`;
  }

  const fromWhatsapp = cleanSender;
  const toWhatsapp = e164.startsWith("whatsapp:") ? e164 : `whatsapp:${e164}`;

  const messagePayload: any = {
    from: fromWhatsapp,
    to: toWhatsapp,
  };

  if (contentSid) {
    messagePayload.contentSid = contentSid;
    if (contentVariables) {
      messagePayload.contentVariables = typeof contentVariables === "string" ? contentVariables : JSON.stringify(contentVariables);
    }
  } else {
    messagePayload.body = message;
  }

  console.log("[WhatsApp Dispatcher] Sending payload to Twilio:", {
    accountSidPrefix: `${accountSid.substring(0, 6)}...`,
    from: messagePayload.from,
    to: messagePayload.to,
    body: messagePayload.body,
    contentSid: messagePayload.contentSid || null,
    contentVariables: messagePayload.contentVariables || null,
  });

  let clientAccountSid = accountSid;
  let clientApiKey = "";
  let clientSecret = authToken;

  if (accountSid.startsWith("SK")) {
    clientApiKey = accountSid;
    clientAccountSid = process.env.TWILIO_ACCOUNT_SID?.startsWith("AC") ? process.env.TWILIO_ACCOUNT_SID : "AC37b605ea2cf1cf2baeb5f7fce3fd6885";
  }

  try {
    const twilioModule = await import("twilio");
    const twilio = twilioModule.default;
    const client = clientApiKey
      ? twilio(clientApiKey, clientSecret, { accountSid: clientAccountSid })
      : twilio(clientAccountSid, clientSecret);

    const response = await client.messages.create(messagePayload);

    console.log("[WhatsApp Dispatcher] Twilio Success Response:", {
      sid: response.sid,
      status: response.status,
      from: response.from,
      to: response.to,
      errorCode: response.errorCode,
      errorMessage: response.errorMessage,
      dateCreated: response.dateCreated,
      dateSent: response.dateSent,
    });

    const logged = recordDispatch({
      type: "whatsapp",
      target: e164,
      recipientName: buyerName || "Buyer",
      message: messagePayload.body || `Template SID: ${contentSid}`,
      status: "delivered_real",
      details: `Successfully dispatched via Twilio WhatsApp Gateway (SID: ${response.sid}, Status: ${response.status}).`,
      directLink: waDirectUrl,
    });

    return res.status(200).json({
      success: true,
      messageSid: response.sid,
      status: response.status,
      from: response.from,
      to: response.to,
      formattedPhone: e164,
      directUrl: waDirectUrl,
      message: `Successfully transmitted WhatsApp notification to ${e164}.`,
      log: logged,
      twilioResponse: {
        sid: response.sid,
        status: response.status,
        dateCreated: response.dateCreated,
        dateSent: response.dateSent,
        errorCode: response.errorCode,
        errorMessage: response.errorMessage,
        body: response.body,
        numSegments: response.numSegments,
      },
    });
  } catch (err: any) {
    const errCode = err?.code || 500;
    const isAuthError = errCode === 20003 || String(err?.message || "").toLowerCase().includes("authenticate");
    const isContentSidError = errCode === 21654 || String(err?.message || "").toLowerCase().includes("contentsid");

    console.warn("[WhatsApp Dispatcher]: Twilio dispatch status:", {
      code: errCode,
      message: err?.message,
      isAuthError,
      isContentSidError
    });

    let userFacingMsg = err?.message || "Failed to dispatch WhatsApp notification via Twilio.";
    if (isAuthError) {
      userFacingMsg = "Twilio Authentication Required (Error 20003): Your Twilio Account SID or Auth Token was rejected by Twilio. Please verify your credentials in console.twilio.com.";
    } else if (isContentSidError) {
      userFacingMsg = "24-Hour WhatsApp Session Required (Error 21654): Meta WhatsApp policy requires the recipient phone number to send a message (e.g. 'join <sandbox-code>') to +1 415 523 8886 first to open a 24-hour conversation window. Alternatively, click 'Launch Direct WhatsApp' below to dispatch immediately without sandbox restrictions.";
    }

    recordDispatch({
      type: "whatsapp",
      target: e164,
      recipientName: buyerName || "Buyer",
      message: message || `Template: ${contentSid}`,
      status: "failed",
      details: `Twilio Notice (${errCode}): ${userFacingMsg}`,
      directLink: waDirectUrl,
    });

    return res.status(isAuthError ? 401 : (isContentSidError ? 400 : 500)).json({
      success: false,
      error: userFacingMsg,
      code: err?.code || (isAuthError ? 20003 : (isContentSidError ? 21654 : 500)),
      moreInfo: err?.moreInfo || "https://www.twilio.com/docs/errors/21654",
      status: isAuthError ? 401 : (isContentSidError ? 400 : (err?.status || 500)),
      type: "TwilioRestException",
      formattedPhone: e164,
      directUrl: waDirectUrl,
      isAuthError,
      isContentSidError,
    });
  }
});

// REAL DISPATCH ROUTER: SMS NOTIFICATIONS via Twilio
app.post("/api/dispatch-sms", async (req, res) => {
  const { to, recipientName, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: "Recipient phone number ('to') and 'message' are required." });
  }

  const { e164, national } = formatPhoneNumber(String(to));
  const smsDirectUrl = `sms:${e164}?body=${encodeURIComponent(message)}`;

  const rawSid = req.body.accountSid || process.env.TWILIO_ACCOUNT_SID || "";
  const rawToken = req.body.authToken || process.env.TWILIO_AUTH_TOKEN || "";
  const rawPhone = req.body.fromSender || process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_WHATSAPP_NUMBER || "";

  const accountSid = String(rawSid).trim().replace(/^["']|["']$/g, '');
  const authToken = String(rawToken).trim().replace(/^["']|["']$/g, '');
  const twilioPhone = String(rawPhone).trim().replace(/^["']|["']$/g, '');

  console.log("[Twilio Environment Check - SMS]", {
    hasAccountSid: !!accountSid,
    accountSidPrefix: accountSid ? `${accountSid.substring(0, 6)}...` : "MISSING",
    hasAuthToken: !!authToken,
    hasPhoneNumber: !!twilioPhone,
    phoneNumber: twilioPhone || "MISSING",
    nodeEnv: process.env.NODE_ENV || "development",
  });

  if (!accountSid || !authToken || !twilioPhone) {
    const missing = [
      !accountSid && "TWILIO_ACCOUNT_SID",
      !authToken && "TWILIO_AUTH_TOKEN",
      !twilioPhone && "TWILIO_PHONE_NUMBER",
    ].filter(Boolean) as string[];

    console.info(`[SMS Dispatcher] Twilio credentials not configured in environment (${missing.join(", ")}). Running in fallback simulated mode with direct SMS link.`);

    const logged = recordDispatch({
      type: "sms",
      target: e164,
      recipientName: recipientName || "Recipient",
      message,
      status: "delivered_simulated",
      details: `Twilio SMS credentials (${missing.join(", ")}) not set in environment. Simulated dispatch recorded in backend logs; direct SMS link generated.`,
      directLink: smsDirectUrl,
    });

    return res.status(200).json({
      success: true,
      status: "simulated_success",
      isConfigured: false,
      isLiveSent: false,
      formattedPhone: e164,
      directUrl: smsDirectUrl,
      message: `SMS notification recorded. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in environment variables to deliver directly via Twilio.`,
      missingVariables: missing,
      log: logged,
    });
  }

  const cleanTwilioPhone = twilioPhone.trim().replace("whatsapp:", "");

  const smsPayload = {
    body: message,
    from: cleanTwilioPhone,
    to: e164,
  };

  console.log("[SMS Dispatcher] Sending payload to Twilio:", {
    accountSidPrefix: `${accountSid.substring(0, 6)}...`,
    from: smsPayload.from,
    to: smsPayload.to,
    body: smsPayload.body,
  });

  try {
    const twilioModule = await import("twilio");
    const twilio = twilioModule.default;
    const client = twilio(accountSid, authToken);

    const response = await client.messages.create(smsPayload);

    console.log("[SMS Dispatcher] Twilio Success Response:", {
      sid: response.sid,
      status: response.status,
      from: response.from,
      to: response.to,
      errorCode: response.errorCode,
      errorMessage: response.errorMessage,
      dateCreated: response.dateCreated,
      dateSent: response.dateSent,
    });

    const logged = recordDispatch({
      type: "sms",
      target: e164,
      recipientName: recipientName || "Recipient",
      message,
      status: "delivered_real",
      details: `Successfully sent via Twilio SMS Gateway (SID: ${response.sid}, Status: ${response.status}).`,
      directLink: smsDirectUrl,
    });

    return res.status(200).json({
      success: true,
      messageSid: response.sid,
      status: response.status,
      from: response.from,
      to: response.to,
      formattedPhone: e164,
      directUrl: smsDirectUrl,
      message: `Successfully transmitted SMS notification to ${e164}.`,
      log: logged,
      twilioResponse: {
        sid: response.sid,
        status: response.status,
        dateCreated: response.dateCreated,
        dateSent: response.dateSent,
        errorCode: response.errorCode,
        errorMessage: response.errorMessage,
        body: response.body,
        numSegments: response.numSegments,
      },
    });
  } catch (err: any) {
    console.warn("[SMS Dispatcher Warning Details]:", {
      message: err?.message,
      code: err?.code,
      status: err?.status,
      moreInfo: err?.moreInfo,
    });

    recordDispatch({
      type: "sms",
      target: e164,
      recipientName: recipientName || "Recipient",
      message,
      status: "failed",
      details: `Twilio SMS Error (${err?.code || 500}): ${err?.message || "Failed to dispatch SMS notification."}`,
      directLink: smsDirectUrl,
    });

    return res.status(500).json({
      success: false,
      error: err?.message || "Failed to dispatch SMS notification via Twilio.",
      code: err?.code,
      moreInfo: err?.moreInfo,
      status: err?.status || 500,
      type: "TwilioRestException",
      formattedPhone: e164,
      directUrl: smsDirectUrl,
    });
  }
});

// DISPATCH HISTORY & LIVE TEST BENCH ROUTE
app.get("/api/dispatch-history", (req, res) => {
  dotenv.config({ override: true });
  const smtpConfigured = !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
  const twilioConfigured = !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN
  );
  res.json({
    logs: dispatchHistory,
    configured: {
      smtp: smtpConfigured,
      twilio: twilioConfigured,
    },
    accountSidPrefix: process.env.TWILIO_ACCOUNT_SID ? `${process.env.TWILIO_ACCOUNT_SID.substring(0, 6)}...` : null,
  });
});

// UPDATE TWILIO CREDENTIALS ROUTE
app.post("/api/update-twilio-credentials", async (req, res) => {
  const { accountSid, authToken, whatsappNumber } = req.body;
  if (!accountSid || !authToken) {
    return res.status(400).json({ error: "accountSid and authToken are required" });
  }

  const cleanSid = String(accountSid).trim();
  const cleanToken = String(authToken).trim();
  const cleanNumber = String(whatsappNumber || "+14155238886").trim();

  // Test authentication with Twilio
  try {
    const twilioModule = await import("twilio");
    const twilio = twilioModule.default;
    
    let client: any;
    let targetAccount = cleanSid;

    if (cleanSid.startsWith("SK")) {
      targetAccount = process.env.TWILIO_ACCOUNT_SID?.startsWith("AC") ? process.env.TWILIO_ACCOUNT_SID : "AC37b605ea2cf1cf2baeb5f7fce3fd6885";
      client = twilio(cleanSid, cleanToken, { accountSid: targetAccount });
    } else {
      client = twilio(cleanSid, cleanToken);
    }
    
    // Quick test verification call (fetches account info)
    const accountInfo = await client.api.v2010.accounts(targetAccount).fetch();

    // Update in-memory process.env
    if (!cleanSid.startsWith("SK")) {
      process.env.TWILIO_ACCOUNT_SID = cleanSid;
    }
    process.env.TWILIO_AUTH_TOKEN = cleanToken;
    process.env.TWILIO_WHATSAPP_NUMBER = cleanNumber;

    // Update .env file if it exists
    try {
      const fs = await import("fs");
      const path = await import("path");
      const envPath = path.join(process.cwd(), ".env");
      let envContent = "";
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, "utf-8");
      }
      
      const updateOrAdd = (key: string, val: string, text: string) => {
        const regex = new RegExp(`^${key}=.*$`, "m");
        if (regex.test(text)) {
          return text.replace(regex, `${key}=${val}`);
        }
        return `${text}\n${key}=${val}`;
      };

      envContent = updateOrAdd("TWILIO_ACCOUNT_SID", cleanSid, envContent);
      envContent = updateOrAdd("TWILIO_AUTH_TOKEN", cleanToken, envContent);
      envContent = updateOrAdd("TWILIO_WHATSAPP_NUMBER", cleanNumber, envContent);
      fs.writeFileSync(envPath, envContent.trim() + "\n", "utf-8");
    } catch (fsErr) {
      console.warn("Could not write to .env file:", fsErr);
    }

    return res.json({
      success: true,
      message: `Twilio authenticated successfully! Connected to account: ${accountInfo.friendlyName || cleanSid}`,
      accountName: accountInfo.friendlyName,
      status: accountInfo.status,
    });
  } catch (err: any) {
    console.warn("[Twilio Credential Verification]: Auth rejected:", {
      code: err?.code,
      message: err?.message
    });
    return res.status(401).json({
      success: false,
      error: `Twilio verification failed (${err?.code || 401}): ${err?.message || "Invalid Account SID or Auth Token."}`,
      code: err?.code,
      moreInfo: err?.moreInfo,
    });
  }
});

// MANIFEST OCR & PARSING ROUTE: Parses camera photos of shipment paper manifests
app.post("/api/scan-manifest", async (req, res) => {
  try {
    const { image, mimeType } = req.body;

    if (!image) {
      return res.status(400).json({ error: "Missing required 'image' data in request body." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: "GEMINI_API_KEY environment variable is not configured. Please define it in your Secrets panel." 
      });
    }

    // Extract base64 payload and detect mimeType if provided as data URL
    let cleanBase64 = String(image).trim();
    let detectedMime = mimeType || "image/jpeg";

    const dataUrlMatch = cleanBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (dataUrlMatch) {
      detectedMime = dataUrlMatch[1];
      cleanBase64 = dataUrlMatch[2];
    }

    // Initialize GoogleGenAI SDK
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });

    const promptText = `You are an expert OCR and paper manifest parsing AI specializing in Indian agricultural logistics, grain mandis, and rice transport records.
Carefully analyze this camera photo/scan of a paper manifest, lorry receipt (LR / Bilty), transport consignment note, weighbridge slip, delivery challan, or tax invoice.

Extract all arrival and commercial fields into a valid JSON object with the following schema:
{
  "date": "YYYY-MM-DD", // Shipment, invoice, or bilty date. If day/month is found without year, assume 2026.
  "millerName": "string", // Supplier, Consignor, or Rice Mill name (e.g., ANNAPURNA RICE & AGRO INDUSTRIES)
  "place": "string", // Origin mandi / dispatch city / mill location (e.g., MIRYALGUDA, SURYAPET, KARNAL)
  "brand": "string", // Rice variety or brand (e.g., KESHAR KALI, 1121 Sella Rice, Sona Masoori, Broken Rice 100%)
  "partyName": "string", // Buyer, Consignee, or Trading Party name (e.g., V.K FOODS, PLATINUM TRADERS)
  "area": "string", // Buyer delivery market, shop area, or destination (e.g., 4TH BLOCK, APMC YARD)
  "billNo": "string", // Invoice number, Bilty number, Manifest number, or LR number
  "qty": 0.0, // Total weight in Quintals (QTLS). If bags are given (e.g., 520 bags @ 50kg), calculate quintals = 260.0.
  "rate": 0.0, // Rate or price per quintal in INR
  "amount": 0.0, // Gross value / invoice amount in INR (typically qty * rate)
  "lh": 0.0, // Loading & Hamali (L.H.) charges if stated
  "cc": 0.0, // Commission or brokerage (C.C.) charges if stated
  "tds": 0.0, // TDS deduction if stated
  "shortage": 0.0, // Shortage, moisture or tare allowance if stated
  "diffIn": 0.0, // Price difference or discount adjustment if stated
  "netAmt": 0.0, // Net payable / final receivable amount in INR
  "noOfDayRec": "Not Cleared", // Initial payment status
  "truckNo": "string", // Truck / lorry registration number if visible (e.g., AP24TX8892)
  "purchaseOrderNo": "string", // Associated purchase order or contract number if referenced
  "confidence": 0.95, // Numerical confidence score from 0.0 to 1.0 based on document clarity
  "detectedDocType": "string", // e.g. "Lorry Receipt (Bilty)", "Tax Invoice", "Weighbridge Slip", "Delivery Challan"
  "summary": "string" // A brief 1-2 sentence overview of what was parsed
}

Rules:
1. If a numeric value is not visible or unknown, return null.
2. If a text field is not visible, return empty string "".
3. Standardize dates to YYYY-MM-DD.
4. Clean all numeric fields so they are pure JSON numbers (no currency symbols or commas).
5. Output ONLY the raw JSON object.`;

    const imagePart = {
      inlineData: {
        mimeType: detectedMime,
        data: cleanBase64,
      }
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: {
        parts: [
          imagePart,
          { text: promptText }
        ]
      },
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
      }
    });

    const rawOutput = response.text || "{}";
    let parsedData: any = {};
    try {
      parsedData = JSON.parse(rawOutput);
    } catch (parseErr) {
      // Clean possible backticks
      const sanitized = rawOutput.replace(/```json/gi, "").replace(/```/g, "").trim();
      parsedData = JSON.parse(sanitized);
    }

    // Sanitize calculations if not provided
    if ((parsedData.amount === null || parsedData.amount === undefined || parsedData.amount === 0) && parsedData.qty && parsedData.rate) {
      parsedData.amount = Math.round(Number(parsedData.qty) * Number(parsedData.rate));
    }
    if ((parsedData.netAmt === null || parsedData.netAmt === undefined || parsedData.netAmt === 0) && parsedData.amount) {
      const lh = Number(parsedData.lh) || 0;
      const cc = Number(parsedData.cc) || 0;
      const tds = Number(parsedData.tds) || 0;
      const shortage = Number(parsedData.shortage) || 0;
      const diffIn = Number(parsedData.diffIn) || 0;
      parsedData.netAmt = Math.round(Number(parsedData.amount) + lh + cc - tds - shortage + diffIn);
    }

    return res.json({
      success: true,
      manifest: parsedData,
      rawOutput,
    });
  } catch (error: any) {
    console.error("Error in /api/scan-manifest:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to scan and parse paper manifest using camera image.",
    });
  }
});

export default app;
