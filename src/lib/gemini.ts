import { GoogleGenerativeAI } from "@google/generative-ai";
import { PropertyDetails } from "./schemas";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function generatePropertyDescription(details: PropertyDetails, imageUrls: string[]) {
  try {
    // 1. Initialize the Multimodal Model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 2. Prepare the Image Data (Convert URLs to base64 if needed, or use public URLs)
    const imageParts = await Promise.all(
      imageUrls.map(async (url) => {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        return {
          inlineData: {
            data: Buffer.from(buffer).toString("base64"),
            mimeType: "image/jpeg",
          },
        };
      })
    );

    // 3. The Master B2B Prompt
    const prompt = `
      ACT AS: A Senior Real Estate Appraiser and B2B Marketing Specialist for Realtysharks.
      
      INPUT DATA:
      - Property Details: ${JSON.stringify(details)}
      - Visual Context: Provided via attached images.

      INSTRUCTIONS:
      1. ANALYZE IMAGES: Identify the interior quality, floor finish, natural lighting, and any premium fixtures visible. 
      2. FACTUAL ALIGNMENT: Ensure the description matches the price of ${details.price} and location in ${details.locality}, ${details.city}.
      3. TONE: Professional, sophisticated, and data-driven. Avoid "dream home" or "stunning" clichés. Use "high-yield potential," "architectural integrity," and "strategic location."
      4. STRUCTURE:
         - [Headline]: A powerful, one-line value proposition.
         - [Introduction]: Contextualize the property in its market.
         - [Visual Highlights]: Explicitly mention features seen in the images (e.g., "The marble flooring seen in the living area adds a touch of classic elegance").
         - [Investment/USP]: Why a broker should list this or a client should buy it.
         - [CTA]: Direct instruction to contact the listing broker.

      CONSTRAINT: If images are blurry or irrelevant, ignore them and focus on the technical details provided.
    `;

    // 4. Generate Content
    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    return response.text();

  } catch (error) {
    console.error("AI Auto-Write Error:", error);
    // Fallback: Generate based on text only
    return generateTextOnlyFallback(details);
  }
}

function generateTextOnlyFallback(details: PropertyDetails) {
  const headline = `${details.bedrooms || 3} BHK Premium Residency in ${details.locality || 'Prime Locality'}, ${details.city || 'Strategic City'}`;
  const intro = `Offering an outstanding opportunity in the real estate market, this ${details.propertyType || 'property'} presents a compelling profile with high architectural integrity and strategic value.`;
  const features = `Featuring configured bedroom designs (${details.bedrooms || '3'} BHK), spacious layouts, and situated within the highly sought-after area of ${details.locality || 'the city'}. Evaluated at an acquisition price of ${details.price || 'Market Valuation'}.`;
  const investment = `Positioned for significant capital appreciation and offering robust rental yield potential. Ideal for high-profile portfolios.`;
  const cta = `For structural blueprints, pricing details, or a private walkthrough, contact the listing broker at your earliest convenience.`;

  return `
[Headline]: ${headline}

[Introduction]: ${intro}

[Highlights]: ${features}

[Investment/USP]: ${investment}

[CTA]: ${cta}
  `.trim();
}
