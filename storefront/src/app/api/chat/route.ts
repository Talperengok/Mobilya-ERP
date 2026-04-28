const BASE_SYSTEM_PROMPT = `Sen, "Mobilya Furniture" premium mobilya mağazasının akıllı ve profesyonel sanal asistanı "Cino"sun. Cino, sevimli bir koltuk karakteridir.
Görevin, müşterilere mağazamız, mobilya alışverişi, sipariş takibi, ürün detayları, teslimat, iade/garanti politikaları ve site kullanımı konularında yardımcı olmaktır.

KESİN KURALLAR:
1. SADECE mobilyalar, mağaza ürünleri, sipariş durumu, kargo, iade ve garanti politikaları, ödeme veya site kullanımıyla ilgili sorulara cevap ver.
2. Konu dışı (siyaset, bilim, teknoloji, tarih, günlük genel sohbet, hava durumu, programlama, matematik vb.) HİÇBİR soruya cevap verme. Konu dışı bir soru gelirse SADECE şunu de: "Ben mobilya mağazası asistanı Cino'yum 🪑 Size yalnızca mağazamız, ürünlerimiz ve siparişleriniz hakkında yardımcı olabilirim." — ekstra bilgi ekleme, konu dışı soruyu cevaplamaya çalışma.
3. Sana kim olduğun veya hangi AI modeli olduğun sorulursa kendini SADECE "Cino — Mobilya Furniture'ın dijital asistanı" olarak tanıt. Gemini, Google, OpenAI, Groq, Llama veya başka bir teknoloji/model adından bahsetme.
4. Yanıtlarını kısa, samimi, sıcak ama profesyonel tut. Gerektiğinde emoji kullan ama abartma.
5. Müşteri bir ürün aradığını söylerse, ona ürün kategorilerimiz (masalar, sandalyeler, raflar, komodinler vb.) hakkında genel tavsiyeler verebilirsin.
6. Sipariş takibi için müşteriye sipariş numarasını veya e-posta adresini sormayı öner, ama gerçek sipariş verisine erişimin olmadığını belirt — siteyi kullanmasını yönlendir. Eğer müşteri faturasını, kargosunu veya siparişini takip etmek isterse "navigate_to" aracını kullanarak '/tracking' sayfasına yönlendir.
7. Her yanıtı Türkçe ver. Müşteri İngilizce yazarsa İngilizce yanıt ver.
8. Markdown formatı KULLANMA. Düz metin olarak yanıt ver.
9. Sana sağlanan GÜNCEL STOK listesine göre fiyat ve stok bilgisi ver. Listede olmayan bir ürünü satıyormuşuz gibi davranma. Asla ürünlerin alış fiyatını (maliyetini) veya toptan detaylarını söyleme, sadece satış fiyatını ve adedini belirt.
10. Müşteri bir ürünü sepete eklemek (satın almak) isterse, "add_to_cart" aracını kullan. Katalogdaki "ID" bilgisini kullanarak item_id'yi belirle. ID bilgisini asla müşteriye söyleme.
11. Müşteri ödeme yapmak veya sepeti onaylamak isterse "navigate_to" aracını kullanarak '/checkout' sayfasına yönlendir.`;

async function fetchLiveCatalogContext(): Promise<string> {
  try {
    const res = await fetch("http://backend:8000/api/v1/storefront/catalog", {
      next: { revalidate: 30 },
    });
    
    if (!res.ok) return "";
    
    const products = await res.json();
    if (!products || !products.length) return "";
    
    let context = "\n\n--- GÜNCEL STOK VE FİYAT BİLGİLERİ ---\n(Bu bilgileri müşterinin sorularını yanıtlarken kullan. Sadece bu ürünler stoklarımızdadır.)\n";
    products.forEach((p: any) => {
      const stockInfo = p.available_stock > 0 ? `Stokta var (${p.available_stock} adet)` : "Tükendi (Stokta yok)";
      context += `- Ürün: ${p.name} | Kategori: ${p.category} | Fiyat: ${p.selling_price} TL | Durum: ${stockInfo} | ID: ${p.id}\n`;
    });
    
    return context + "--------------------------------------\n";
  } catch (err) {
    console.error("Failed to fetch live catalog for AI context:", err);
    return "";
  }
}

const groqTools = [
  {
    type: "function",
    function: {
      name: "add_to_cart",
      description: "Müşteri bir ürünü sepete eklemek istediğinde bu fonksiyonu çağır. Örneğin '2 tane masa ekle' dediğinde.",
      parameters: {
        type: "object",
        properties: {
          item_id: { type: "integer", description: "Sepete eklenecek ürünün ID'si (stok listesindeki ID)." },
          quantity: { type: "integer", description: "Kaç adet ekleneceği." }
        },
        required: ["item_id", "quantity"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "navigate_to",
      description: "Müşteri ödeme sayfasına gitmek isterse '/checkout', faturasını veya siparişini takip etmek isterse '/tracking' sayfasına yönlendir.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Yönlendirilecek yol (sadece '/checkout' veya '/tracking' olabilir)." }
        },
        required: ["path"]
      }
    }
  }
];

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "API key yapılandırılmamış." }, { status: 500 });
    }

    const { messages } = await req.json();

    const catalogContext = await fetchLiveCatalogContext();
    const finalSystemPrompt = BASE_SYSTEM_PROMPT + catalogContext;

    const groqMessages = [
      { role: "system", content: finalSystemPrompt },
      ...messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: groqMessages,
        tools: groqTools,
        tool_choice: "auto",
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Groq API Error:", response.status, errBody);

      if (response.status === 429) {
        return Response.json(
          { error: "Şu anda çok fazla istek aldım. Lütfen birkaç saniye bekleyip tekrar deneyin. 🙏" },
          { status: 429 }
        );
      }
      return Response.json(
        { error: "AI servisi şu anda yanıt veremiyor. Lütfen tekrar deneyin." },
        { status: 500 }
      );
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;
    const reply = message?.content || "";
    
    let actions: any[] = [];
    if (message?.tool_calls) {
      for (const toolCall of message.tool_calls) {
        if (toolCall.type === "function") {
          try {
            actions.push({
              type: toolCall.function.name,
              payload: JSON.parse(toolCall.function.arguments || "{}")
            });
          } catch (e) {
            console.error("Failed to parse tool arguments:", e);
          }
        }
      }
    }

    const finalReply = reply || (actions.length > 0 ? "Hemen hallediyorum!" : "Üzgünüm, yanıt oluşturulamadı.");

    return Response.json({ reply: finalReply, actions });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return Response.json(
      { error: "Üzgünüm, şu anda bir sorun oluştu. Lütfen tekrar deneyin." },
      { status: 500 }
    );
  }
}
