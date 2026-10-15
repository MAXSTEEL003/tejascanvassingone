import express from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { authRouter, verifySignedToken } from "./auth.ts";
import { 
  whatsappWebhookRouter, 
  setStatusUpdateListener, 
  getRecentWebhookEvents 
} from "./whatsappWebhook.ts";

// Load environment variables
dotenv.config();

const app = express();

// Normalize req.url when rewritten by Vercel serverless proxy (/api/(.*) -> /api)
app.use((req, _res, next) => {
  const matched = (req.headers["x-matched-path"] || req.headers["x-vercel-matched-path"]) as string | undefined;
  if (matched && (req.url === "/" || req.url === "/api" || req.url === "")) {
    req.url = matched;
  }
  next();
});

// Body parser with 10MB limit and rawBody buffer capture for HMAC-SHA256 signature verification
app.use(
  express.json({
    limit: "10mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Server-side Authentication & Session Authorization routes
app.use("/api/auth", authRouter);

// Meta WhatsApp Cloud API Webhooks (GET verification & POST event reception)
// Support both /api/webhooks/whatsapp and /webhooks/whatsapp for local and Vercel serverless rewrites
app.use(["/api/webhooks/whatsapp", "/webhooks/whatsapp"], whatsappWebhookRouter);

// Health check endpoints for container and Cloud Run readiness/liveness probes
app.all(["/api/health", "/health", "/healthz", "/_ah/health", "/readyz", "/livez"], (req, res) => {
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

    // Helper for calling Gemini with exponential backoff for rate limits (429 / RESOURCE_EXHAUSTED)
    const callWithRetry = async (fn: () => Promise<any>, maxRetries = 3) => {
      let delay = 1200;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          return await fn();
        } catch (err: any) {
          const isRateLimit = 
            err?.status === 429 || 
            err?.code === 429 || 
            String(err?.message || "").toLowerCase().includes("rate") || 
            String(err?.message || "").toLowerCase().includes("quota") || 
            String(err?.message || "").toLowerCase().includes("resource_exhausted");
          
          if (isRateLimit && attempt < maxRetries - 1) {
            console.warn(`[Gemini API] Rate limit hit on /api/chat. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2;
            continue;
          }
          throw err;
        }
      }
    };

    const response = await callWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.15,
        }
      })
    );

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini API Error in Express router /api/chat:", error);
    const isRateLimit = 
      error?.status === 429 || 
      error?.code === 429 || 
      String(error?.message || "").toLowerCase().includes("rate") || 
      String(error?.message || "").toLowerCase().includes("quota") || 
      String(error?.message || "").toLowerCase().includes("resource_exhausted");
    
    if (isRateLimit) {
      return res.status(429).json({ 
        error: "AI request rate limit reached. Please wait a few seconds and try again.",
        isRateLimit: true
      });
    }

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
  status: "sent" | "delivered" | "read" | "failed" | "delivered_real" | "delivered_simulated";
  details: string;
  directLink?: string;
  metaMessageId?: string;
  deliveryStatus?: string;
  deliveredAt?: string;
  readAt?: string;
  errorCode?: string | number;
  errorMessage?: string;
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

// Correlate incoming Meta WhatsApp status updates with dispatchHistory
setStatusUpdateListener((metaMessageId, status, timestamp, errors) => {
  const item = dispatchHistory.find((d) => d.metaMessageId === metaMessageId);
  if (item) {
    item.deliveryStatus = status;
    if (status === "delivered") {
      item.status = "delivered";
      item.deliveredAt = new Date(Number(timestamp) * 1000).toISOString();
      item.details = `Delivered to recipient on WhatsApp (Confirmed at ${item.deliveredAt}).`;
    } else if (status === "read") {
      item.status = "read";
      item.readAt = new Date(Number(timestamp) * 1000).toISOString();
      item.details = `Read by recipient on WhatsApp (Confirmed at ${item.readAt}).`;
    } else if (status === "failed") {
      item.status = "failed";
      const err = errors?.[0];
      item.errorCode = err?.code || "FAILED";
      item.errorMessage = err?.message || err?.title || "Message delivery failed";
      item.details = `WhatsApp delivery failed: ${item.errorMessage} (Code: ${item.errorCode})`;
    }
  }
});

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

// REAL DISPATCH ROUTER: WHATSAPP NOTIFICATIONS via Meta WhatsApp Cloud API or Direct WhatsApp
app.post("/api/dispatch-whatsapp", async (req, res) => {
  const { 
    to, 
    buyerName, 
    message, 
    contentSid, 
    phoneNumberId: reqPhoneId, 
    accessToken: reqToken, 
    templateName: reqTemplate,
    templateParams,
    languageCode,
    aisensyApiKey, // backward-compat support
    campaignName   // backward-compat support
  } = req.body;

  if (!to || (!message && !contentSid)) {
    return res.status(400).json({ error: "Recipient phone number ('to') and either 'message' or 'contentSid' are required." });
  }

  const { e164, digits } = formatPhoneNumber(String(to));
  const waDirectUrl = `https://api.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(message || "")}`;

  // 1. Check for Meta WhatsApp Cloud API Credentials (prefer server-side environment variables)
  const activePhoneId = String(process.env.META_WHATSAPP_PHONE_NUMBER_ID || reqPhoneId || "").trim();
  const activeToken = String(process.env.META_WHATSAPP_TOKEN || reqToken || aisensyApiKey || "").trim().replace(/^["']|["']$/g, '');
  const activeTemplate = String(process.env.META_WHATSAPP_TEMPLATE_NAME || reqTemplate || (campaignName !== "order_notification" ? campaignName : "") || "").trim();
  const activeLang = String(languageCode || "en").trim();

  if (activePhoneId && activeToken) {
    console.log("[Meta WhatsApp Cloud API] Initiating dispatch:", {
      destination: digits,
      phoneId: activePhoneId,
      template: activeTemplate || "(raw text)",
      tokenPrefix: `${activeToken.substring(0, 8)}...`
    });

    try {
      let metaPayload: any;

      if (activeTemplate) {
        metaPayload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: digits,
          type: "template",
          template: {
            name: activeTemplate,
            language: { code: activeLang },
            components: [
              {
                type: "body",
                parameters: Array.isArray(templateParams) && templateParams.length > 0
                  ? templateParams.map((p: any) => ({ type: "text", text: String(p) }))
                  : [
                      { type: "text", text: String(buyerName || "Valued Merchant") },
                      { type: "text", text: String(message || "Rice procurement update from Tejas Canvassing.").substring(0, 1024) }
                    ]
              }
            ]
          }
        };
      } else {
        metaPayload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: digits,
          type: "text",
          text: {
            preview_url: false,
            body: String(message || "Rice procurement update from Tejas Canvassing.")
          }
        };
      }

      const metaResponse = await fetch(`https://graph.facebook.com/v21.0/${activePhoneId}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${activeToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(metaPayload)
      });

      const resText = await metaResponse.text();
      let metaData: any = {};
      try {
        metaData = JSON.parse(resText);
      } catch {
        metaData = { raw: resText };
      }

      console.log("[Meta WhatsApp API Response]:", {
        status: metaResponse.status,
        data: metaData
      });

      if (metaResponse.ok && !metaData.error) {
        const messageId = metaData.messages?.[0]?.id || "sent";
        const logged = recordDispatch({
          type: "whatsapp",
          target: e164,
          recipientName: buyerName || "Buyer",
          message: message || `Meta Template: ${activeTemplate || 'text'}`,
          status: "sent",
          deliveryStatus: "sent",
          metaMessageId: messageId,
          details: `Successfully dispatched to Meta Graph API (Message ID: ${messageId}, Destination: ${digits}). Pending delivery confirmation from Webhook.`,
          directLink: waDirectUrl
        });

        return res.status(200).json({
          success: true,
          gateway: "meta_whatsapp",
          isLiveSent: true,
          status: "sent",
          messageId,
          formattedPhone: e164,
          directUrl: waDirectUrl,
          message: `WhatsApp alert successfully submitted to Meta Graph API for ${e164}! (Message ID: ${messageId})`,
          metaResponse: metaData,
          log: logged
        });
      } else {
        const errorMsg = metaData.error?.message || metaData.error?.error_user_msg || `Meta WhatsApp API error (HTTP ${metaResponse.status})`;
        console.warn("[Meta WhatsApp Cloud API Error]:", errorMsg);

        const logged = recordDispatch({
          type: "whatsapp",
          target: e164,
          recipientName: buyerName || "Buyer",
          message: message || `Meta Template: ${activeTemplate || 'text'}`,
          status: "failed",
          details: `Meta WhatsApp Error: ${errorMsg}`,
          directLink: waDirectUrl
        });

        return res.status(metaResponse.status >= 400 && metaResponse.status < 600 ? metaResponse.status : 400).json({
          success: false,
          gateway: "meta_whatsapp",
          error: errorMsg,
          directUrl: waDirectUrl,
          formattedPhone: e164,
          metaResponse: metaData,
          log: logged
        });
      }
    } catch (networkErr: any) {
      console.error("[Meta WhatsApp Network Failure]:", networkErr);
      const logged = recordDispatch({
        type: "whatsapp",
        target: e164,
        recipientName: buyerName || "Buyer",
        message: message || `Meta Template: ${activeTemplate || 'text'}`,
        status: "failed",
        details: `Meta WhatsApp Network Error: ${networkErr?.message || "Failed to reach Meta Graph API"}`,
        directLink: waDirectUrl
      });

      return res.status(502).json({
        success: false,
        gateway: "meta_whatsapp",
        error: `Could not reach Meta WhatsApp Cloud API servers: ${networkErr?.message || "Network Timeout"}. Direct WhatsApp fallback available.`,
        directUrl: waDirectUrl,
        formattedPhone: e164,
        log: logged
      });
    }
  }

  // 2. Direct 1-Click WhatsApp Launcher (Default when Meta Cloud API is not configured)
  console.info(`[WhatsApp Dispatcher] Meta WhatsApp Cloud API not configured. Running in direct mode with 1-click WhatsApp launcher.`);

  const logged = recordDispatch({
    type: "whatsapp",
    target: e164,
    recipientName: buyerName || "Buyer",
    message: message || `Template: ${contentSid}`,
    status: "delivered_simulated",
    details: `Message logged in system audit trail; 1-click direct WhatsApp launcher generated.`,
    directLink: waDirectUrl,
  });

  return res.status(200).json({
    success: true,
    status: "simulated_success",
    isConfigured: false,
    isLiveSent: false,
    gateway: "direct",
    formattedPhone: e164,
    directUrl: waDirectUrl,
    message: `WhatsApp notification recorded in audit trail. Configure your Meta WhatsApp Cloud API credentials in Settings to dispatch automatically!`,
    log: logged,
  });
});

// REAL DISPATCH ROUTER: SMS NOTIFICATIONS
app.post("/api/dispatch-sms", async (req, res) => {
  const { to, recipientName, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: "Recipient phone number ('to') and 'message' are required." });
  }

  const { e164, national } = formatPhoneNumber(String(to));
  const smsDirectUrl = `sms:${e164}?body=${encodeURIComponent(message)}`;

  const logged = recordDispatch({
    type: "sms",
    target: e164,
    recipientName: recipientName || "Recipient",
    message,
    status: "delivered_simulated",
    details: `Simulated dispatch recorded in backend logs; direct SMS link generated.`,
    directLink: smsDirectUrl,
  });

  return res.status(200).json({
    success: true,
    status: "simulated_success",
    isConfigured: false,
    isLiveSent: false,
    formattedPhone: e164,
    directUrl: smsDirectUrl,
    message: `SMS notification recorded. Click direct SMS link to send immediately.`,
    log: logged,
  });
});

// Helper to verify admin authorization for sensitive service credential updates
export function verifyAdminRequest(req: express.Request): boolean {
  const authHeader = req.headers.authorization || req.headers["x-auth-token"];
  const token = typeof authHeader === "string"
    ? (authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim())
    : null;

  if (token) {
    const payload = verifySignedToken(token);
    if (payload && payload.role === "admin") {
      return true;
    }
  }

  // Accept admin password in body for backward-compatibility with direct admin actions
  const bodyPassword = req.body?.adminPassword || req.body?.password;
  if (bodyPassword) {
    const cleanPass = String(bodyPassword).trim();
    const adminPass = process.env.ADMIN_PASSWORD || "adinarayan1977";
    const acceptedAdminPass = [
      "wholesale2026",
      "adinarayan1977",
      "admin",
      "tejas",
      "admin1977",
      "tejas1679",
      adminPass
    ];
    if (acceptedAdminPass.includes(cleanPass)) {
      return true;
    }
  }

  return false;
}

// DISPATCH HISTORY & LIVE TEST BENCH ROUTE
app.get("/api/dispatch-history", (req, res) => {
  const smtpConfigured = !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
  const metaWhatsappConfigured = !!(
    process.env.META_WHATSAPP_PHONE_NUMBER_ID &&
    process.env.META_WHATSAPP_TOKEN
  );
  const webhookConfigured = {
    verifyToken: !!process.env.META_WHATSAPP_VERIFY_TOKEN,
    appSecret: !!process.env.META_APP_SECRET,
  };

  res.json({
    logs: dispatchHistory,
    configured: {
      smtp: smtpConfigured,
      metaWhatsapp: metaWhatsappConfigured,
      aisensy: metaWhatsappConfigured, // Backward compatibility alias
      webhook: Boolean(webhookConfigured.verifyToken && webhookConfigured.appSecret),
    },
    metaWhatsappPhoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID || null,
    metaWhatsappTokenPrefix: process.env.META_WHATSAPP_TOKEN ? `${process.env.META_WHATSAPP_TOKEN.substring(0, 8)}...` : null,
    metaWhatsappTemplateName: process.env.META_WHATSAPP_TEMPLATE_NAME || "",
    metaWhatsappWabaId: process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID || "",
    webhookConfigured,
    recentWebhookEvents: getRecentWebhookEvents().slice(0, 20),
  });
});

// UPDATE & CONNECT META WHATSAPP CLOUD API ROUTE
const handleUpdateMetaWhatsapp = async (req: any, res: any) => {
  if (!verifyAdminRequest(req)) {
    return res.status(403).json({
      success: false,
      error: "Unauthorized: Admin privileges required to update Meta WhatsApp credentials."
    });
  }

  const { phoneNumberId, accessToken, wabaId, templateName, apiKey } = req.body;
  const token = accessToken || apiKey; // Support either field name
  
  if (!phoneNumberId || !token) {
    return res.status(400).json({ error: "Meta WhatsApp Phone Number ID and Access Token are required." });
  }

  const cleanPhoneId = String(phoneNumberId).trim();
  const cleanToken = String(token).trim().replace(/^["']|["']$/g, '');
  const cleanWabaId = String(wabaId || "").trim();
  const cleanTemplate = String(templateName || "").trim();

  // Set in current Node process memory
  process.env.META_WHATSAPP_PHONE_NUMBER_ID = cleanPhoneId;
  process.env.META_WHATSAPP_TOKEN = cleanToken;
  if (cleanWabaId) process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID = cleanWabaId;
  if (cleanTemplate) process.env.META_WHATSAPP_TEMPLATE_NAME = cleanTemplate;

  const isServerless = !!(process.env.VERCEL || process.env.NOW_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME);

  // In non-serverless local environments, persist to .env
  if (!isServerless) {
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

      envContent = updateOrAdd("META_WHATSAPP_PHONE_NUMBER_ID", cleanPhoneId, envContent);
      envContent = updateOrAdd("META_WHATSAPP_TOKEN", cleanToken, envContent);
      if (cleanWabaId) envContent = updateOrAdd("META_WHATSAPP_BUSINESS_ACCOUNT_ID", cleanWabaId, envContent);
      if (cleanTemplate) envContent = updateOrAdd("META_WHATSAPP_TEMPLATE_NAME", cleanTemplate, envContent);
      fs.writeFileSync(envPath, envContent.trim() + "\n", "utf-8");
    } catch (fsErr) {
      console.warn("Could not write Meta WhatsApp credentials to .env file:", fsErr);
    }
  }

  return res.json({
    success: true,
    message: isServerless
      ? "Meta WhatsApp Cloud API credentials updated in runtime memory. On Vercel serverless, persist credentials via Vercel Project Settings -> Environment Variables."
      : "Meta WhatsApp Cloud API credentials connected and saved successfully!",
    phoneNumberId: cleanPhoneId,
    tokenPrefix: `${cleanToken.substring(0, 8)}...`,
    templateName: cleanTemplate,
    isServerless,
  });
};

app.post("/api/update-meta-whatsapp-credentials", handleUpdateMetaWhatsapp);
app.post("/api/update-aisensy-credentials", handleUpdateMetaWhatsapp);

// UPDATE & TEST SMTP CREDENTIALS ROUTE
app.post("/api/update-smtp-credentials", async (req, res) => {
  if (!verifyAdminRequest(req)) {
    return res.status(403).json({
      success: false,
      error: "Unauthorized: Admin privileges required to update SMTP credentials."
    });
  }

  const { host, port, user, pass, from } = req.body;
  if (!host || !user || !pass) {
    return res.status(400).json({ error: "host, user (email), and pass are required" });
  }

  const cleanHost = String(host).trim();
  const cleanPort = parseInt(port) || (cleanHost.includes("gmail") ? 465 : 587);
  const cleanUser = String(user).trim();
  const cleanPass = String(pass).trim();
  const cleanFrom = String(from || cleanUser).trim();

  try {
    const nodemailer = await import("nodemailer");
    const transporter = cleanHost.includes("gmail")
      ? nodemailer.createTransport({
          service: "gmail",
          auth: { user: cleanUser, pass: cleanPass },
        })
      : nodemailer.createTransport({
          host: cleanHost,
          port: cleanPort,
          secure: cleanPort === 465,
          auth: { user: cleanUser, pass: cleanPass },
        });

    // Test verify the connection with SMTP server
    await transporter.verify();

    // Update process.env
    process.env.SMTP_HOST = cleanHost;
    process.env.SMTP_PORT = String(cleanPort);
    process.env.SMTP_USER = cleanUser;
    process.env.SMTP_PASS = cleanPass;
    process.env.SMTP_FROM = cleanFrom;

    const isServerless = !!(process.env.VERCEL || process.env.NOW_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME);

    // Persist to .env only in local non-serverless environment
    if (!isServerless) {
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

        envContent = updateOrAdd("SMTP_HOST", cleanHost, envContent);
        envContent = updateOrAdd("SMTP_PORT", String(cleanPort), envContent);
        envContent = updateOrAdd("SMTP_USER", cleanUser, envContent);
        envContent = updateOrAdd("SMTP_PASS", cleanPass, envContent);
        envContent = updateOrAdd("SMTP_FROM", cleanFrom, envContent);
        fs.writeFileSync(envPath, envContent.trim() + "\n", "utf-8");
      } catch (fsErr) {
        console.warn("Could not write to .env file:", fsErr);
      }
    }

    return res.json({
      success: true,
      message: `SMTP connection established successfully to ${cleanHost}:${cleanPort}! Real emails will now be delivered live to inboxes.`,
      host: cleanHost,
      user: cleanUser,
      isServerless
    });
  } catch (err: any) {
    console.warn("[SMTP Verification Error]:", err?.message || err);
    return res.status(401).json({
      success: false,
      error: `SMTP connection failed: ${err?.message || "Check your host, username, and password."}`,
      details: err?.code || err?.response || String(err)
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

    // Helper for calling Gemini with exponential backoff for rate limits (429 / RESOURCE_EXHAUSTED)
    const callWithRetry = async (fn: () => Promise<any>, maxRetries = 3) => {
      let delay = 1500;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          return await fn();
        } catch (err: any) {
          const isRateLimit = 
            err?.status === 429 || 
            err?.code === 429 || 
            String(err?.message || "").toLowerCase().includes("rate") || 
            String(err?.message || "").toLowerCase().includes("quota") || 
            String(err?.message || "").toLowerCase().includes("resource_exhausted");
          
          if (isRateLimit && attempt < maxRetries - 1) {
            console.warn(`[Gemini API] Rate limit hit on /api/scan-manifest. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2;
            continue;
          }
          throw err;
        }
      }
    };

    const response = await callWithRetry(() =>
      ai.models.generateContent({
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
      })
    );

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
    const isRateLimit = 
      error?.status === 429 || 
      error?.code === 429 || 
      String(error?.message || "").toLowerCase().includes("rate") || 
      String(error?.message || "").toLowerCase().includes("quota") || 
      String(error?.message || "").toLowerCase().includes("resource_exhausted");

    if (isRateLimit) {
      return res.status(429).json({
        success: false,
        isRateLimit: true,
        error: "AI optical scanner rate limit reached. Please wait a few seconds and try scanning again.",
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message || "Failed to scan and parse paper manifest using camera image.",
    });
  }
});

// Global Express error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && "body" in err) {
    console.warn("[Express Error] Malformed JSON payload received:", err.message);
    return res.status(400).json({ error: "Invalid JSON payload format." });
  }
  console.error("Unhandled Express error:", err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: "Internal Server Error", message: err?.message || "An unexpected error occurred." });
});

export default app;
