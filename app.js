/**
 * app.js — Saha Takip Mini App
 * 00-referans.xlsx → referans.json → dropdown'lar
 * tg.sendData() → bot.py web_app_data_handler → excel_bridge → Excel
 */

const tg = window.Telegram?.WebApp || { initDataUnsafe: {}, sendData: () => {}, showAlert: (m) => alert(m), expand: () => {}, ready: () => {}, close: () => {} };
const { createApp, ref, computed, onMounted } = Vue;

// ── MODÜL TANIMI ─────────────────────────────────────────────
// Her modülün hangi roller görebileceği ve özellikleri
const MODULLER = [
  { id: 'ilerleme', ad: 'İlerleme',       ikon: '📊', renk: 'mavi',   roller: ['SEF','MUD','TAS','UST','KAL'] },
  { id: 'puantaj',  ad: 'Puantaj',        ikon: '👷', renk: 'yesil',  roller: ['SEF','TAS','DEPO'] },
  { id: 'sorun',    ad: 'Sorun / NCR',    ikon: '⚠️', renk: 'kirmizi',roller: ['SEF','MUD','TAS','UST','ISG','KAL'] },
  { id: 'malzeme',  ad: 'Malzeme',        ikon: '📦', renk: 'turuncu',roller: ['SEF','DEPO','SATIN','TAS'] },
  { id: 'gunluk',   ad: 'Günlük Rapor',   ikon: '📋', renk: 'mor',    roller: ['SEF','MUD'] },
  { id: 'durum',    ad: 'Saha Durumu',    ikon: '📈', renk: 'lacivert',roller: ['SEF','MUD','TAS','UST','ISG','KAL','DEPO','SATIN'] },
  { id: 'soru',     ad: '@SahaBot\'a Sor',ikon: '🤖', renk: 'siyah',  roller: ['SEF','MUD','TAS','UST','ISG','KAL','DEPO','SATIN'] },
];

const MODUL_BASLIKLAR = {
  ilerleme: '📊 İlerleme Girişi',
  puantaj:  '👷 Puantaj',
  sorun:    '⚠️ Sorun Bildir',
  malzeme:  '📦 Malzeme Hareketi',
  gunluk:   '📋 Günlük Rapor',
  durum:    '📈 Saha Durumu',
  soru:     '🤖 SahaBot',
};

createApp({
  setup() {
    const yukleniyor   = ref(true);
    const gonderiyor   = ref(false);
    const online       = ref(navigator.onLine);
    const aktifModul   = ref(null);
    const soruCevap    = ref('');
    const yukleniyorDashboard = ref(false);

    // ── Kullanıcı ─────────────────────────────────────────────
    const tgUser = tg.initDataUnsafe?.user || {};
    const kullanici = ref({ ad: tgUser.first_name || 'Misafir', rol: '', telegramId: String(tgUser.id || '') });

    // ── Referans verisi (00-referans.xlsx kaynaklı) ───────────
    const refs = ref({
      bloklar: [], katlar: [], taseronlar: [], makineler: [],
      malzemeler: [], kategoriler: [], isKalemleri: [],
      kullanicilar: [], roller: [], kodlar: {}
    });

    // ── Dashboard verisi ──────────────────────────────────────
    const ozet = ref({ personel: null, ilerleme: null, acikSorun: null });
    const blokDurumlar = ref([]);

    // ── Form state ────────────────────────────────────────────
    const _bos = () => ({
      // ortak
      blok: '', kat: '', taseron: '',
      // ilerleme
      kategoriKod: '', kalem: '', gun_miktar: '', birim: '', plan_miktar: '', not_: '',
      // puantaj
      gelen: '', baslangic: '08:00', bitis: '17:00',
      // sorun
      tip: '', aciklama: '',
      // malzeme
      yon: 'Giris', miktar: '',
      // gunluk
      imalat: '', durum: '',
      // soru
      soru: '',
    });
    const f = ref(_bos());

    // ── Computed ──────────────────────────────────────────────
    const filtreliKalemler = computed(() =>
      f.value.kategoriKod
        ? refs.value.isKalemleri.filter(k => k.kategoriKod === f.value.kategoriKod)
        : refs.value.isKalemleri
    );

    const sorunTipleri = computed(() =>
      refs.value.kodlar?.SORUN_TIP || [
        { kod: 'KALITE',   ad: 'Kalite Uygunsuzluk' },
        { kod: 'ISG',      ad: 'İSG İhlali' },
        { kod: 'TEKNIK',   ad: 'Teknik Sorun' },
        { kod: 'MALZEME',  ad: 'Malzeme Hatası' },
        { kod: 'TASERON',  ad: 'Taşeron Sorunu' },
      ]
    );

    const durumKodlari = computed(() =>
      refs.value.kodlar?.DURUM || [
        { kod: 'Normal',      ad: 'Normal' },
        { kod: 'Gecikme',     ad: 'Gecikme Var' },
        { kod: 'Kritik',      ad: 'Kritik Gecikme' },
        { kod: 'Tamamlandi',  ad: 'Tamamlandı' },
      ]
    );

    const modulBaslik = computed(() => MODUL_BASLIKLAR[aktifModul.value] || '');

    const gorunenmoduller = computed(() => {
      const rol = kullanici.value.rol;
      if (!rol) return MODULLER; // rol bilinmiyorsa tümünü göster
      return MODULLER.filter(m => m.roller.includes(rol));
    });

    // ── Lifecycle ─────────────────────────────────────────────
    onMounted(async () => {
      tg.expand();
      tg.ready();

      window.addEventListener('online',  () => { online.value = true;  _offlineGonder(); });
      window.addEventListener('offline', () => { online.value = false; });

      await _referansYukle();
      _rolBelirle();
      yukleniyor.value = false;
    });

    // ── Referans yükle ────────────────────────────────────────
    const _referansYukle = async () => {
      try {
        const r = await fetch('referans.json?t=' + Date.now());
        if (!r.ok) throw new Error('HTTP ' + r.status);
        refs.value = await r.json();
      } catch (e) {
        console.warn('referans.json yüklenemedi:', e);
        refs.value.bloklar = ['A','B','C','D','ORTAK'];
        refs.value.katlar  = ['B2','B1','ZM','01','02','03','CT'];
      }
    };

    // ── Rol belirle (referans.json kullanıcılar listesinden) ──
    const _rolBelirle = () => {
      const tid = kullanici.value.telegramId;
      const bulunan = refs.value.kullanicilar?.find(u => u.telegramId === tid);
      if (bulunan) {
        kullanici.value.ad  = bulunan.ad || kullanici.value.ad;
        kullanici.value.rol = bulunan.rol || '';
      }
      // DEV: Telegram dışı açıldıysa geliştirici modu — SEF göster
      if (!tg.initDataUnsafe?.user && !kullanici.value.rol) {
        kullanici.value.rol = 'SEF';
        kullanici.value.ad  = 'Geliştirici';
      }
    };

    // ── Modül aç ──────────────────────────────────────────────
    const modulAc = (id) => {
      aktifModul.value = id;
      f.value = _bos();
      soruCevap.value = '';
      if (id === 'durum') _dashboardYukle();
    };

    // ── Dashboard yükle ───────────────────────────────────────
    const _dashboardYukle = async () => {
      yukleniyorDashboard.value = true;
      try {
        const r = await fetch('/api/dashboard');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const d = await r.json();
        // api_server.py response: { kpi: {toplamPersonel, ilerlemeKayit, acikSorun}, blokOzet: [{blok, ortalamaPct}] }
        ozet.value = {
          personel:  d.kpi?.toplamPersonel ?? '—',
          ilerleme:  d.kpi?.ilerlemeKayit  ?? '—',
          acikSorun: d.kpi?.acikSorun      ?? '—',
        };
        blokDurumlar.value = (d.blokOzet || []).map(b => ({
          blok:  b.blok,
          yuzde: b.ortalamaPct || 0,
        }));
      } catch {
        ozet.value = { personel: '—', ilerleme: '—', acikSorun: '—' };
        blokDurumlar.value = [];
      } finally {
        yukleniyorDashboard.value = false;
      }
    };

    // ── Form gönder ───────────────────────────────────────────
    const gonder = (action) => {
      const uid  = tg.initDataUnsafe?.user?.id || 0;
      const zaman = new Date().toISOString();

      let payload = { action, user_id: uid, tarih: zaman };

      if (action === 'ilerleme') {
        if (!f.value.kalem || !f.value.blok || !f.value.kat || !f.value.gun_miktar) {
          tg.showAlert('⚠️ Kalem, Blok, Kat ve Günlük Miktar zorunlu!'); return;
        }
        // birim otomatik doldur (seçili kalemden)
        const kalemObj = refs.value.isKalemleri.find(k => k.ad === f.value.kalem);
        payload = { ...payload,
          kalem:       f.value.kalem,
          blok:        f.value.blok,
          kat:         f.value.kat,
          taseron:     f.value.taseron,
          gun_miktar:  parseFloat(f.value.gun_miktar),
          birim:       f.value.birim || kalemObj?.birim || 'adet',
          plan_miktar: parseFloat(f.value.plan_miktar) || 0,
          not_:        f.value.not_,
        };
      }
      else if (action === 'puantaj') {
        if (!f.value.taseron || !f.value.gelen) {
          tg.showAlert('⚠️ Taşeron ve Gelen Kişi zorunlu!'); return;
        }
        payload = { ...payload,
          taseron:   f.value.taseron,
          kalem:     f.value.kalem,
          blok:      f.value.blok,
          gelen:     parseInt(f.value.gelen),
          plan:      parseInt(f.value.gelen), // plan = gelen (sonradan düzeltilebilir)
          baslangic: f.value.baslangic || '08:00',
          bitis:     f.value.bitis     || '17:00',
        };
      }
      else if (action === 'sorun') {
        if (!f.value.blok || !f.value.tip || !f.value.aciklama) {
          tg.showAlert('⚠️ Blok, Tip ve Açıklama zorunlu!'); return;
        }
        payload = { ...payload,
          blok:     f.value.blok,
          kat:      f.value.kat,
          tip:      f.value.tip,
          aciklama: f.value.aciklama,
        };
      }
      else if (action === 'malzeme') {
        if (!f.value.kalem || !f.value.miktar) {
          tg.showAlert('⚠️ Malzeme ve Miktar zorunlu!'); return;
        }
        // birim otomatik
        const mlzObj = refs.value.malzemeler?.find(m => m.ad === f.value.kalem);
        payload = { ...payload,
          yon:   f.value.yon || 'Giris',
          kalem: f.value.kalem,
          miktar: parseFloat(f.value.miktar),
          birim:  f.value.birim || mlzObj?.birim || 'adet',
          not_:   f.value.not_,
        };
      }
      else if (action === 'gunluk') {
        if (!f.value.blok || !f.value.durum) {
          tg.showAlert('⚠️ Blok ve Durum zorunlu!'); return;
        }
        payload = { ...payload,
          blok:    f.value.blok,
          kat:     f.value.kat,
          imalat:  f.value.imalat,
          taseron: f.value.taseron,
          durum:   f.value.durum,
        };
      }

      _gonderPayload(payload);
    };

    // ── Soru gönder (@SahaBot) ────────────────────────────────
    const soruGonder = () => {
      if (!f.value.soru.trim()) return;
      const payload = {
        action:  'soru',
        user_id: tg.initDataUnsafe?.user?.id || 0,
        soru:    f.value.soru.trim(),
      };
      _gonderPayload(payload, false); // sayfayı kapatma
    };

    // ── Payload ilet (tg.sendData veya offline queue) ─────────
    const _gonderPayload = (payload, kapat = false) => {
      const json = JSON.stringify(payload);

      if (!online.value) {
        // Offline: localStorage'a kaydet
        const queue = JSON.parse(localStorage.getItem('sahaQueue') || '[]');
        queue.push(payload);
        localStorage.setItem('sahaQueue', JSON.stringify(queue));
        tg.showAlert('📴 İnternet yok — veri telefona kaydedildi.');
        return;
      }

      gonderiyor.value = true;
      try {
        tg.sendData(json);
        f.value = _bos();
        aktifModul.value = null;
        // Mini App kapatılmayabilir (dashboard görmek için açık kal)
      } catch (e) {
        tg.showAlert('❌ Gönderim hatası: ' + e.message);
      } finally {
        gonderiyor.value = false;
      }
    };

    // ── Offline queue gönder ──────────────────────────────────
    const _offlineGonder = () => {
      const queue = JSON.parse(localStorage.getItem('sahaQueue') || '[]');
      if (!queue.length) return;
      tg.showAlert(`📶 Bağlantı geldi! ${queue.length} bekleyen veri gönderiliyor...`);
      queue.forEach(p => {
        try { tg.sendData(JSON.stringify(p)); } catch {}
      });
      localStorage.removeItem('sahaQueue');
    };

    return {
      yukleniyor, gonderiyor, online,
      aktifModul, modulAc, modulBaslik,
      kullanici, refs, f,
      gorunenmoduller,
      filtreliKalemler, sorunTipleri, durumKodlari,
      gonder, soruGonder, soruCevap,
      ozet, blokDurumlar, yukleniyorDashboard,
    };
  }
}).mount('#app');
