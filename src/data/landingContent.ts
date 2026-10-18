export const SITE_NAME = 'Ekolojik Market POS';
export const SITE_TAGLINE = 'Doğal ürün mağazanız için akıllı satış ve stok yönetimi';

export const NAV_LINKS = [
  { to: '/', label: 'Ana Sayfa' },
  { to: '/urunler', label: 'Ürünler' },
  { to: '/ozellikler', label: 'Özellikler' },
  { to: '/blog', label: 'Blog' },
  { to: '/fiyatlar', label: 'Fiyatlar' },
  { to: '/iletisim', label: 'İletişim' },
] as const;

export const FEATURES = [
  {
    icon: '🛒',
    title: 'Hızlı Satış Ekranı',
    description: 'Barkod, arama ve set satışı ile kasada saniyeler içinde işlem tamamlayın.',
  },
  {
    icon: '📦',
    title: 'Stok Takibi',
    description: 'Gerçek zamanlı stok, düşük stok uyarıları ve numune yönetimi.',
  },
  {
    icon: '👥',
    title: 'Müşteri Yönetimi',
    description: 'Bireysel ve kurumsal müşteri kayıtları, Greenleaf üye numarası entegrasyonu.',
  },
  {
    icon: '💰',
    title: 'Kasa & Muhasebe',
    description: 'Günlük kasa oturumu, giderler, alış faturaları ve KDV raporları.',
  },
  {
    icon: '📊',
    title: 'Raporlar & Panel',
    description: 'Satış analizi, ödeme takvimi, vergi hatırlatıcıları ve kullanıcı aktivitesi.',
  },
  {
    icon: '🔐',
    title: 'Güvenli Erişim',
    description: 'Rol bazlı yetkiler, PIN girişi, 2FA ve giriş denemesi kilidi.',
  },
  {
    icon: '💱',
    title: 'Döviz & Fiyat',
    description: 'TCMB kurları, çoklu para birimi ve partner/perakende fiyat tipleri.',
  },
  {
    icon: '📱',
    title: 'Her Cihazda',
    description: 'Tarayıcıdan çalışır; tablet, telefon ve masaüstünde aynı deneyim.',
  },
];

export const PRICING_PLANS = [
  {
    id: 'trial',
    name: 'Deneme',
    price: '0',
    period: '14 gün',
    description: 'Tüm özellikleri ücretsiz deneyin',
    features: [
      '1 mağaza',
      '2 kullanıcı',
      'Satış & stok modülleri',
      'Temel raporlar',
      'E-posta desteği',
    ],
    cta: 'Ücretsiz Dene',
    highlighted: false,
  },
  {
    id: 'starter',
    name: 'Başlangıç',
    price: '499',
    period: 'aylık',
    description: 'Küçük mağazalar için',
    features: [
      '1 mağaza',
      '5 kullanıcı',
      'Tüm POS modülleri',
      'Muhasebe & raporlar',
      'Öncelikli destek',
      'Veri yedekleme',
    ],
    cta: 'Hemen Başla',
    highlighted: true,
  },
  {
    id: 'business',
    name: 'İşletme',
    price: '899',
    period: 'aylık',
    description: 'Büyüyen işletmeler için',
    features: [
      '3 mağaza',
      '15 kullanıcı',
      'Tüm modüller',
      'Fatura e-posta entegrasyonu',
      'ASAT / fatura sorguları',
      'Push bildirimler',
      '7/24 destek',
    ],
    cta: 'İletişime Geç',
    highlighted: false,
  },
];

export const BLOG_POSTS = [
  {
    id: '1',
    slug: 'ekolojik-market-pos-nedir',
    title: 'Ekolojik Market POS Nedir?',
    excerpt: 'Doğal ve organik ürün satan mağazalar için özel olarak tasarlanmış bulut tabanlı satış noktası sistemi.',
    date: '2026-09-01',
    category: 'Genel',
    readMin: 4,
  },
  {
    id: '2',
    slug: 'stok-yonetimi-ipuclari',
    title: 'Ekolojik Ürün Mağazasında Stok Yönetimi İpuçları',
    excerpt: 'Son kullanma tarihi, numune stokları ve düşük stok uyarıları ile fireyi azaltmanın yolları.',
    date: '2026-09-05',
    category: 'Stok',
    readMin: 6,
  },
  {
    id: '3',
    slug: 'kasiyer-pin-guvenligi',
    title: 'Kasiyer PIN Güvenliği Nasıl Sağlanır?',
    excerpt: 'Hızlı kasa girişi ile güvenliği dengelemek: PIN, rol yetkileri ve otomatik çıkış.',
    date: '2026-09-08',
    category: 'Güvenlik',
    readMin: 5,
  },
  {
    id: '4',
    slug: 'vergi-takvimi-hatirlatici',
    title: 'Vergi Takvimi Hatırlatıcıları ile Ödemeleri Kaçırmayın',
    excerpt: 'KDV, muhtasar ve SGK ödemelerini otomatik takvim ile yönetin.',
    date: '2026-09-10',
    category: 'Muhasebe',
    readMin: 7,
  },
];

export const STATS = [
  { value: '136+', label: 'Hazır ürün kataloğu' },
  { value: '9', label: 'Modül' },
  { value: '5dk', label: 'Kurulum süresi' },
  { value: '7/24', label: 'Bulut erişim' },
];

/** Ana sayfa hero görseli — gerçek satış/kasa verisi göstermez */
export const HERO_PREVIEW = {
  title: 'Ekolojik Market POS — Modül Önizleme',
  items: [
    { icon: '🛒', label: 'Hızlı satış ve barkod okuma' },
    { icon: '📦', label: 'Stok ve numune takibi' },
    { icon: '💰', label: 'Günlük kasa oturumu ve raporlar' },
    { icon: '🔐', label: 'Rol bazlı güvenli erişim' },
  ],
};
