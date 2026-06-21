import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { supabase } from './supabase/client';

export const generatePdfFlyer = async (listingId: string | number) => {
  try {
    // 1. Fetch full listing data and broker profile
    const { data: listing, error } = await supabase
      .from('listings')
      .select('*, profiles!listings_broker_id_fkey(*)')
      .eq('id', listingId)
      .single();

    if (error || !listing) throw new Error("Could not fetch listing details for PDF");

    const profile = Array.isArray(listing.profiles) ? listing.profiles[0] : listing.profiles;

    // 2. Create a temporary invisible container for the flyer
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '800px'; // A4 width ratio
    container.style.height = '1131px'; // A4 height ratio
    container.style.backgroundColor = '#FFFFFF';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.color = '#000000';
    container.style.overflow = 'hidden';
    
    // Add content
    const imageUrl = Array.isArray(listing.images) && listing.images.length > 0 ? listing.images[0] : null;
    const priceFormatted = listing.price_inr >= 10000000 
      ? `Rs ${(listing.price_inr / 10000000).toFixed(2)} Cr` 
      : `Rs ${listing.price_inr.toLocaleString('en-IN')}`;

    // 3. Generate QR Code
    const qrUrl = `https://realtysharks.in/messages?brokerId=${profile.auth_id}&listingId=${listing.id}&title=${encodeURIComponent(listing.title)}&price=${encodeURIComponent(priceFormatted)}&location=${encodeURIComponent(listing.city)}`;
    const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 1, width: 80, color: { dark: '#050505', light: '#FFFFFF' } });

    container.innerHTML = `
      <!-- Header -->
      <div style="background-color: #050505; color: #FFFFFF; padding: 30px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 style="margin: 0; font-size: 32px; color: #10B981; text-transform: uppercase;">REALTYSHARKS</h1>
          <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">Exclusive Institutional Network</p>
        </div>
        <div style="text-align: right;">
          <h2 style="margin: 0; font-size: 24px;">${profile?.agency_name || 'Verified Broker'}</h2>
          <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">${profile?.full_name || ''}</p>
        </div>
      </div>

      <!-- Hero Image -->
      ${imageUrl ? `
      <div style="width: 100%; height: 450px; background-color: #f1f1f1; overflow: hidden; position: relative;">
        <img src="${imageUrl}" crossorigin="anonymous" style="width: 100%; height: 100%; object-fit: cover;" />
        ${listing.direct_mandate_only ? `
        <div style="position: absolute; top: 20px; left: 20px; background-color: #EF4444; color: white; padding: 10px 20px; font-weight: bold; border-radius: 4px; font-size: 16px;">
          DIRECT MANDATE
        </div>` : ''}
      </div>
      ` : '<div style="width: 100%; height: 450px; background-color: #f1f1f1; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #aaa;">No Image Available</div>'}

      <!-- Content Body -->
      <div style="padding: 40px;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px;">
          <div style="flex: 1;">
            <p style="margin: 0; color: #10B981; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; font-size: 14px;">${listing.property_type}</p>
            <h1 style="margin: 10px 0; font-size: 36px; line-height: 1.2;">${listing.title}</h1>
            <p style="margin: 0; font-size: 18px; color: #555;">${listing.locality || listing.city}, ${listing.city}</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-size: 14px; color: #888;">Asking Price</p>
            <h2 style="margin: 5px 0; font-size: 32px; color: #000;">${priceFormatted}</h2>
          </div>
        </div>

        <!-- Key Specs -->
        <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
          <div style="text-align: center; flex: 1; border-right: 1px solid #eee;">
            <p style="margin: 0; font-size: 14px; color: #888;">Configuration</p>
            <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold;">${listing.configuration}</p>
          </div>
          <div style="text-align: center; flex: 1; border-right: 1px solid #eee;">
            <p style="margin: 0; font-size: 14px; color: #888;">Area (sq.ft)</p>
            <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold;">${listing.square_feet?.toLocaleString() || 'N/A'}</p>
          </div>
          <div style="text-align: center; flex: 1;">
            <p style="margin: 0; font-size: 14px; color: #888;">Location</p>
            <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold;">${listing.city}</p>
          </div>
        </div>

        <!-- Description -->
        <div>
          <h3 style="font-size: 20px; margin-bottom: 15px; color: #333;">Property Details</h3>
          <p style="font-size: 16px; line-height: 1.6; color: #555; white-space: pre-wrap;">${listing.description || 'No description provided.'}</p>
        </div>
      </div>

      <!-- Footer Contact -->
      <div style="position: absolute; bottom: 0; left: 0; right: 0; background-color: #f8f9fa; padding: 30px; border-top: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <p style="margin: 0; font-size: 14px; color: #888;">Contact Broker</p>
          <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold;">${profile?.full_name || 'Verified Broker'}</p>
          <p style="margin: 5px 0 0 0; font-size: 16px; color: #555;">${profile?.phone_number || ''}</p>
        </div>
        <div style="display: flex; align-items: center; gap: 15px;">
          <div style="text-align: right;">
            <p style="margin: 0; font-size: 12px; color: #888;">Scan to Chat on</p>
            <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold; color: #10B981;">RealtySharks Network</p>
          </div>
          <img src="${qrDataUrl}" style="width: 60px; height: 60px; border-radius: 4px;" />
        </div>
      </div>
    `;

    document.body.appendChild(container);

    // Wait for images to load (a simple timeout to let crossOrigin images load)
    await new Promise(r => setTimeout(r, 1000));

    // 3. Render Canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
    });

    document.body.removeChild(container);

    // 4. Generate PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [800, 1131]
    });

    const imgData = canvas.toDataURL('image/jpeg', 1.0);
    pdf.addImage(imgData, 'JPEG', 0, 0, 800, 1131);
    
    const fileName = `${listing.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_flyer.pdf`;
    pdf.save(fileName);
    
    return true;
  } catch (err) {
    console.error("Failed to generate PDF:", err);
    throw err;
  }
};
