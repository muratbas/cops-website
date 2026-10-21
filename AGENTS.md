# AGENTS.md — C-Ops Hub (FACEIT + HLTV Hibrit Platformu)

Bu dosya, projede çalışan AI geliştirici ajanları için mimari kuralları, güvenlik sınırlarını ve kodlama standartlarını tanımlar. Kod üretirken veya mevcut kodu düzenlerken buradaki kurallara **istisnasız** uyulmalıdır.

## 1. Proje Özeti

Critical Ops (C-Ops) oyunu için resmi Public API'yi kullanan; oyuncu istatistikleri, özel Rating hesaplaması, liderlik tabloları (HLTV kısmı) ve 5v5 lobi, gerçek zamanlı harita veto, oyun içi otomatik özel oda kurma (FACEIT kısmı) özelliklerini barındıran web platformu.

## 2. Teknoloji Yığını ve Sürüm Kuralları

- **Framework:** Next.js 15 (App Router) & React 19
  - **KRİTİK Next.js 15 Kuralı:** Sayfa ve Route Handler'larda `params` ve `searchParams` artık birer Promise'dir. Kullanmadan önce **mutlaka `await`** edilmelidir (Örn: `const { id } = await params;`).
  - Varsayılan olarak tüm bileşenler **Server Component** olmalıdır. Sadece etkileşimli (state, event listener, Firestore `onSnapshot` dinleyicileri) bileşenlerin en üstüne `"use client"` eklenmelidir.
- **Dil:** TypeScript (Strict Mode). `any` kullanımı kesinlikle yasaktır. Tüm C-Ops API yanıtları `src/types/cops.ts` altındaki arayüzlerle (interface) tiplenmelidir.
- **Stil & UI:** Tailwind CSS + shadcn/ui + Lucide Icons. UI ve bileşen tasarımlarında projeye dahil edilen Taste Skill kurallarına (özellikle App/Dashboard ekran disiplinine, anti-slop kurallarına ve veri tablosu hiyerarşisine) sadık kal. Standart AI gradyanları veya jenerik SaaS kartları kullanma.
  - Tasarım Dili: Koyu (Dark) espor teması (`bg-zinc-950`, `bg-neutral-900`), keskin hatlar, yüksek kontrastlı veri tabloları ve kehribar/turuncu (`amber-500` / `orange-600`) vurgu renkleri.
- **Veritabanı & Gerçek Zamanlı Durum:** Firebase (Firestore).
  - Harita Veto ekranları ve Lobi durumları Firestore `onSnapshot` ile gerçek zamanlı senkronize edilmelidir.

## 3. Critical Ops Public API Kuralları (ÇOK ÖNEMLİ)

1. **Sıfır İstemci Sızıntısı (Zero Client Leak):**
   - `process.env.COPS_API_KEY` **ASLA** `"use client"` bileşenlerinde kullanılamaz ve `NEXT_PUBLIC_` öneki alamaz.
   - C-Ops API'sine yapılan tüm istekler yalnızca `src/lib/cops-api.ts` içindeki sunucu taraflı istemci üzerinden (Server Components, Server Actions veya Route Handlers aracılığıyla) yapılmalıdır.
2. **Rate Limiting ve Önbellekleme (Caching):**
   - API yanıt başlıklarındaki `X-RateLimit-Remaining` ve `X-RateLimit-Reset` değerleri her istekte kontrol edilmelidir.
   - Oyuncu profilleri (`Players`) ve sıralama tabloları (`Leaderboards`) her sayfa yenilemede doğrudan C-Ops API'sinden çekilmemeli; Firestore veya Next.js `unstable_cache` / `fetch revalidate` (örn: 300 saniye TTL) ile önbelleklenmelidir.
3. **Oyun Kuralları ve Harita Sabitleri (Game Rules & Maps):**
   - Otomatik maç (`Automated Matches POST`) oluştururken yalnızca resmi harita ve mod sabitleri kullanılmalıdır (`Bureau`, `Canals`, `Grounded`, `Legacy`, `Plaza`, `Port`, `Raid`, `Soar`, `Village`, `Brewery`). Rastgele harita string'leri uydurulmamalıdır.

## 4. Klasör ve Dosya Mimarisi

Yeni özellik eklerken şu dizin yapısına sadık kal:

- `src/app/` -> Next.js 15 App Router sayfaları ve API Route Handler'ları
- `src/components/ui/` -> Temel tasarım bileşenleri (shadcn)
- `src/components/match/` -> Lobi, Harita Veto ve Maç odası bileşenleri
- `src/components/stats/` -> HLTV tarzı oyuncu istatistik kartları, grafikler ve tablolar
- `src/lib/cops-api.ts` -> C-Ops Public API merkezi sunucu istemcisi
- `src/lib/firebase.ts` -> Firebase / Firestore istemci ve admin yapılandırması
- `src/lib/rating.ts` -> Özel C-Ops Rating 2.0 hesaplama algoritması
- `src/types/cops.ts` -> OpenAPI şemasından türetilmiş TypeScript veri tipleri

## 5. Çalışma ve Kod Üretim Prensipleri

- **Modülerlik:** Tek bir dosyada 250+ satırlık devasa bileşenler yazma; alt bileşenlere (sub-components) böl.
- **Hata Yönetimi:** C-Ops API'si çöktüğünde, bakımda olduğunda veya oyuncu bulunamadığında (404 / 429 Too Many Requests) uygulama çökmemeli; kullanıcıya şık bir espor temalı hata/bilgi kartı (Fallback UI) gösterilmelidir.
- **Adım Adım İlerleme:** Bir özelliği yazarken önce veri tipini (`src/types`), sonra API/servis fonksiyonunu (`src/lib`), en son UI bileşenini oluştur.
