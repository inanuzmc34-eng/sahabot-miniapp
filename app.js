// app.js (Vue 3 Uygulaması)
const tg = window.Telegram.WebApp;

const { createApp, ref, onMounted, computed } = Vue;

createApp({
    setup() {
        const isTelegramEnv = !!tg.initDataUnsafe?.user;
        const devMode = true; // Test için false yaparsanız tarayıcıdan açılmaz
        
        const isLoading = ref(true);
        const isOnline = ref(navigator.onLine);
        
        // Navbar state
        const currentTab = ref('form');
        
        // Telegram User Data
        const user = ref({
            first_name: tg.initDataUnsafe?.user?.first_name || "Geliştirici",
            photo_url: tg.initDataUnsafe?.user?.photo_url || null,
            id: tg.initDataUnsafe?.user?.id || 123456
        });
        
        const roleText = ref("Yetki Analiz Ediliyor...");
        const isAdmin = ref(false);

        // Form State
        const form = ref({
            kategori: '',
            blok: '',
            kat: '',
            imalat: '',
            miktar: ''
        });
        const photoFile = ref(null);

        // Dropdown Refs
        const refsData = ref({ bloklar: [], katlar: [], imalatlar: [] });

        // Admin State
        const adminUsers = ref({});

        // --- LIFECYCLE ---
        onMounted(async () => {
            tg.expand();
            tg.ready();
            
            // Eğer Telegram renkleri geldiyse ayarla
            tg.setHeaderColor?.('bg_color');

            window.addEventListener('online', () => { isOnline.value = true; checkOfflineQueue(); });
            window.addEventListener('offline', () => isOnline.value = false);

            await fetchReferences();
            await authenticateUser();
            
            isLoading.value = false;
        });

        // --- MOCK API CALLS (Gerçekte backend'e gidecek) ---
        const fetchReferences = async () => {
            try {
                const res = await fetch('referans.json');
                const data = await res.json();
                refsData.value = data;
            } catch (err) {
                console.warn("referans.json çekilemedi", err);
                refsData.value = {
                    bloklar: ["A","B","C","ORTAK"],
                    katlar: ["B2","B1","ZM","01"],
                    imalatlar: ["Kalıp","Demir","Beton"]
                };
            }
        };

        const authenticateUser = async () => {
            // İLERİDE: backend'e `tg.initData` yollanarak JWT ve Yetki istenecek.
            // ŞİMDİLİK: Prototype logic
            if(user.value.id === 123456 || tg.initDataUnsafe?.user?.username === 'ADMIN_USERNAME') {
                isAdmin.value = true;
                roleText.value = "Şantiye Şefi (Tam Yetki)";
            } else {
                roleText.value = "Saha Personeli";
            }
        };

        const fetchUsers = async () => {
            // TODO: backend endpoint `GET /api/users`
            // Şimdilik sahte veri (Mock)
            adminUsers.value = {
                "8520392049": { name: "Erhan Şef", role: "SEF", approved: true },
                "9483829123": { name: "Ahmet Usta (Taşeron)", role: "TAS", approved: true },
                "1122334455": { name: "Mehmet Mühendis", role: "BEKLEYEN", approved: false }
            };
        };

        // --- DOSYA YÜKLEME ---
        const fileInput = ref(null);
        const photoBase64 = ref(null);

        const handleFileUpload = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            photoFile.value = file;
            
            const reader = new FileReader();
            reader.onload = (evt) => { photoBase64.value = evt.target.result; };
            reader.readAsDataURL(file);
        };

        // --- FORMU GÖNDERME ---
        const submitForm = () => {
            if(!form.value.kategori || !form.value.blok) {
                tg.showAlert("⚠️ Lütfen Kategori ve Blok bilgisini doldurun.");
                return;
            }

            const payload = {
                action: "saha_veri",
                user_id: user.value.id,
                ...form.value,
                timestamp: new Date().toISOString()
            };

            // Eger Telegram `sendData` kullanmak istersek:
            if (!isOnline.value) {
                // Offline LocalStorage Write
                let queue = JSON.parse(localStorage.getItem('sahaBotQueue') || '[]');
                queue.push(payload);
                localStorage.setItem('sahaBotQueue', JSON.stringify(queue));
                tg.showAlert("İnternet yok! Veri telefona kaydedildi.");
            } else {
                // Burada IDEAL de `fetch('api/submit', {method:'POST', body: JSON.stringify(payload)})` kullanılmalı.
                // Biz prototipte Telegram SendData'yı (botun algılaması için) çağıracağız
                tg.sendData(JSON.stringify(payload));
                // tg.close(); // Kapansın mı, açık mı kalsın? Dashboard'ı görmesi için açık kalsın:
                tg.showAlert("✅ Veri başarıyla bota aktarıldı!");
                
                // Formu temizle
                form.value.miktar = '';
                photoFile.value = null; 
                photoBase64.value = null;
            }
        };

        const checkOfflineQueue = () => {
            let queue = JSON.parse(localStorage.getItem('sahaBotQueue') || '[]');
            if(queue.length > 0) {
                tg.showAlert(`Bekleyen ${queue.length} veriniz var. Otomatik eşleniyor...`);
                // Send queue items one by one or batch
                localStorage.removeItem('sahaBotQueue');
            }
        };

        // --- ADMIN ISSUES ---
        const approveUser = (id) => {
            // API çağrısı: update `users.json`
            adminUsers.value[id].approved = true;
            tg.showAlert(`${adminUsers.value[id].name} başarıyla onaylandı.`);
        };
        const updateRole = (id, newRole) => {
             // API çağrısı
             tg.showAlert(`Görev "${newRole}" olarak güncellendi.`);
        }

        return {
            isTelegramEnv, devMode, isLoading, isOnline,
            currentTab, user, roleText, isAdmin,
            form, refs: refsData, submitForm,
            photoFile, fileInput, handleFileUpload,
            adminUsers, fetchUsers, approveUser, updateRole
        };
    }
}).mount('#app');
