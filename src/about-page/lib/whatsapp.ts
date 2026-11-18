export const WHATSAPP = "919811022334"

export const waLink = (
  msg = "Hello Tejas Canvassing, I would like a quote for rice.",
) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`
