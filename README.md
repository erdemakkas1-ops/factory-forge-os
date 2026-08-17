# Fabrika Yönetim

FABRİKA YÖNETİM SİSTEMİ – MASTER PROMPT

Modern, profesyonel ve gerçek bir fabrikada kullanılabilecek, tamamen responsive bir Fabrika Yönetim Sistemi geliştir.

Bu proje sadece görsel bir demo veya statik dashboard OLMAMALI. Gerçek veritabanı, authentication, rol bazlı yetkilendirme, CRUD işlemleri, bildirimler ve raporlama sistemi olan çalışan bir web uygulaması olmalıdır.

1. TEKNOLOJİ VE MİMARİ

Uygulamada:

React + TypeScript

Tailwind CSS

shadcn/ui

Supabase

PostgreSQL

Supabase Authentication

Supabase Storage

Row Level Security (RLS)

kullan.

Kod yapısı modüler, ölçeklenebilir ve ileride geliştirilebilir olsun.

Frontend ile database işlemlerini birbirinden mantıksal olarak ayır.

TypeScript tiplerini düzgün kullan.

Tekrarlanan componentler oluşturma; reusable component yapısı kullan.

Uygulama:

Masaüstü

Laptop

Tablet

Telefon

ekranlarında düzgün çalışmalı.

Mobil görünüm masaüstünün küçültülmüş hali olmamalı; mobil kullanım için optimize edilmelidir.

2. TASARIM

Modern bir endüstriyel ERP/MES arayüzü tasarla.

Tasarım:

sade

premium

profesyonel

hızlı okunabilir

kurumsal

modern

olsun.

Ana layout:

Sol tarafta collapsible sidebar.

Üst tarafta header.

Header içerisinde:

global arama

bildirim ikonu

okunmamış bildirim sayısı

kullanıcı profil menüsü

tema değiştirme

bulunsun.

Light Mode ve Dark Mode destekle.

Durumlar için tutarlı badge sistemi kullan:

Yeşil: Tamamlandı

Sarı: Bekliyor

Mavi: Devam ediyor

Kırmızı: Gecikti / Kritik

Gri: Pasif / İptal

Dashboard kartları, tablolar, grafikler ve modal/dialog yapıları modern ve sade olsun.

3. AUTHENTICATION

Gerçek authentication sistemi oluştur.

Giriş ekranında:

şirket logosu

kullanıcı adı veya e-posta

parola

şifre göster/gizle

beni hatırla

şifremi unuttum

giriş yap

bulunsun.

Supabase Authentication kullan.

Şifreler hiçbir zaman açık metin olarak tutulmasın.

Kullanıcı giriş yapmadan uygulama sayfalarına erişemesin.

Session kontrolü yap.

Logout sistemi oluştur.

4. ROL VE YETKİ SİSTEMİ

Aşağıdaki varsayılan rolleri oluştur:

Admin

Patron / Yönetici

İnsan Kaynakları

Üretim Müdürü

Depo / Stok Sorumlusu

Birim Sorumlusu

Personel

Rol bazlı erişim sistemi oluştur.

Sadece sidebar menülerini gizlemek yeterli değildir.

Hem frontend hem backend/database seviyesinde yetki kontrolü yapılmalıdır.

Supabase RLS politikalarını kullan.

Admin bütün sisteme erişebilsin.

Patron bütün operasyonları görüntüleyebilsin ve raporlara erişebilsin.

İK personel işlemlerini yönetebilsin.

Üretim Müdürü üretim emirlerini oluşturabilsin, yönetebilsin ve birim sorumlularına iş atayabilsin.

Depo sorumlusu stok giriş/çıkış ve depo işlemlerini yönetebilsin.

Birim sorumlusu kendi birimine gelen işleri görebilsin ve personele görev atayabilsin.

Personel yalnızca kendisine atanmış işleri ve kendisine açık bilgileri görebilsin.

İleride özel roller oluşturulabilmesi için permission tabanlı altyapı hazırla.

5. DASHBOARD

Dashboard kullanıcının rolüne göre değişsin.

Patron Dashboard

Göster:

toplam çalışan

aktif çalışan

açık sipariş

üretimdeki sipariş

geciken sipariş

günlük üretim

haftalık üretim

aylık üretim

kritik stok

açık iş emirleri

geciken işler

tamamlanan işler

Grafikler:

aylık üretim

sipariş durumları

stok hareketleri

görev durumları

departman performansı

Son aktiviteler ve kritik uyarılar gösterilsin.

Üretim Müdürü Dashboard

açık üretim emirleri

bugün üretilecek ürünler

geciken üretimler

departman görevleri

üretim hedefleri

tamamlanan üretimler

Depo Dashboard

kritik stoklar

son stok girişleri

son stok çıkışları

bekleyen stok talepleri

depo durumları

Personel Dashboard

bugün yapılacak işler

aktif görevler

yaklaşan görevler

geciken görevler

son bildirimler

6. ORGANİZASYON YAPISI

Departman sistemi oluştur.

Her departmanda:

ad

kod

açıklama

yönetici

aktif/pasif

bulunsun.

Departmanların altında alt birimler oluşturulabilsin.

Örneğin:

Üretim

Kesim

Montaj

Paketleme

Her birime sorumlu kullanıcı atanabilsin.

Personeller departman ve birimlere bağlanabilsin.

7. PERSONEL YÖNETİMİ

Personel listesi oluştur.

Personel kartında:

profil fotoğrafı

personel numarası

ad

soyad

telefon

e-posta

departman

birim

pozisyon

bağlı olduğu yönetici

işe giriş tarihi

vardiya

aktif/pasif

görev durumu

bulunsun.

Personel detay ekranında:

profil

aktif görevler

geçmiş görevler

izinler

aktivite geçmişi

sekmeleri olsun.

8. ÜRÜN YÖNETİMİ

Ürün kartı sistemi oluştur.

Ürün türleri:

Hammadde

Yarı Mamul

Mamul

Sarf Malzeme

Yedek Parça

Ürün alanları:

otomatik ürün kodu

ürün adı

kategori

ürün türü

açıklama

ürün görseli

barkod

QR kod

ölçü birimi

minimum stok

maksimum stok

alış fiyatı

satış fiyatı

aktif/pasif

Ürün detay sayfasında:

genel bilgiler

stok durumu

depo dağılımı

stok hareketleri

bağlı siparişler

dosyalar

aktivite geçmişi

göster.

9. DEPO YÖNETİMİ

Çoklu depo desteği oluştur.

Örnek:

Ana Depo

Hammadde Deposu

Mamul Deposu

Yedek Parça Deposu

Depo bilgilerinde:

depo adı

kod

adres/konum açıklaması

sorumlu

aktif/pasif

bulunsun.

Depolar içerisinde raf/lokasyon sistemi oluştur.

Ürünlerin hangi depo ve rafta bulunduğu görülebilsin.

10. STOK YÖNETİMİ

Stok hiçbir zaman yalnızca products tablosundaki tek bir sayı olarak tutulmamalıdır.

Stok hareket tabanlı tasarlanmalıdır.

Stok hareket türleri:

Giriş

Çıkış

Transfer

Üretim Tüketimi

Üretim Girişi

Düzeltme

İade

Her hareket:

ürün

depo

raf

miktar

işlem türü

kullanıcı

tarih/saat

açıklama

referans

sipariş

üretim emri

bilgilerini içersin.

Negatif stok varsayılan olarak engellensin.

Yanlış stok hareketleri silinmesin.

Ters/düzeltme hareketi oluşturulsun.

11. KRİTİK STOK

Mevcut stok minimum stok seviyesine düştüğünde sistem otomatik kritik stok durumu oluştursun.

Dashboard üzerinde göster.

Depo sorumlusuna bildirim oluştur.

Gerekirse yöneticilere bildirim oluştur.

12. MÜŞTERİ YÖNETİMİ

Müşteri kartı oluştur.

Alanlar:

firma adı

müşteri kodu

yetkili kişi

telefon

e-posta

adres

vergi bilgileri

notlar

aktif/pasif

Müşteri detayında geçmiş siparişler gösterilsin.

13. TEDARİKÇİ YÖNETİMİ

Tedarikçi kartı oluştur.

Alanlar:

firma

tedarikçi kodu

yetkili

telefon

e-posta

adres

sağladığı ürünler

notlar

aktif/pasif

14. SİPARİŞ YÖNETİMİ

Sipariş oluşturma ekranı oluştur.

Sipariş:

otomatik sipariş numarası

müşteri

birden fazla ürün

ürün miktarları

sipariş tarihi

teslim tarihi

sorumlu

açıklama

durum

içersin.

Durumlar:

Taslak → Onay Bekliyor → Onaylandı → Üretim Bekliyor → Üretimde → Hazır → Sevk Edildi → Tamamlandı

İptal durumu da olsun.

Sipariş detay ekranında timeline göster.

15. ÜRETİM EMİRLERİ

Sipariş üretim gerektiriyorsa üretim emri oluşturulabilsin.

Üretim emri:

otomatik üretim emri numarası

ürün

üretilecek miktar

ilgili sipariş

planlanan başlangıç

planlanan bitiş

üretim müdürü

departman

birim

sorumlu

öncelik

durum

açıklama

içersin.

Durumlar:

Planlandı → Atandı → Üretim Bekliyor → Üretimde → Kontrol Bekliyor → Tamamlandı → İptal

16. GÖREV / İŞ EMRİ YÖNETİMİ

Görev oluşturma sistemi yap.

Görev:

otomatik görev numarası

başlık

açıklama

üretim emri

departman

birim

atanan kişi

oluşturan kişi

başlangıç

deadline

öncelik

durum

içersin.

Öncelikler:

Düşük

Normal

Yüksek

Acil

Durumlar:

Bekliyor

Başlanmadı

Devam Ediyor

Beklemede

Kontrol Bekliyor

Tamamlandı

İptal

Deadline geçen tamamlanmamış görevleri otomatik gecikmiş olarak göster.

17. BİLDİRİM SİSTEMİ

Gerçek database tabanlı notification sistemi oluştur.

Bildirim türleri:

Yeni görev

Üretim emri

Sipariş

Kritik stok

Geciken görev

Onay

Stok

Personel

Sistem

Bildirim:

başlık

mesaj

kullanıcı

tür

ilgili kayıt

oluşturulma zamanı

okundu/okunmadı

alanlarını içersin.

Header üzerinde notification bell oluştur.

Okunmamış bildirim sayısını badge olarak göster.

"tümünü okundu işaretle" özelliği ekle.

18. ONAY MEKANİZMASI

Genel approval sistemi oluştur.

Onaya gönderilebilecek işlemler:

stok düzeltme

kritik stok çıkışı

sipariş iptali

üretim iptali

satın alma talebi

izin talebi

Approval:

talep eden

onaylayacak kişi

işlem türü

ilgili kayıt

açıklama

tarih

durum

red nedeni

içersin.

Durumlar:

Bekliyor / Onaylandı / Reddedildi

19. TAKVİM

Takvim modülü oluştur.

Görünümler:

Gün

Hafta

Ay

Takvim üzerinde:

görevler

üretim planları

sipariş teslim tarihleri

izinler

gösterilsin.

20. RAPORLAMA

Rapor merkezi oluştur.

Rapor türleri:

Stok

Stok giriş

Stok çıkış

Üretim

Sipariş

Görev

Geciken işler

Personel

Departman

Müşteri

Tedarikçi

Raporlarda:

tarih aralığı

departman

kullanıcı

ürün

durum

depo

gibi filtreler kullanılabilsin.

21. EXCEL VE PDF

Filtrelenmiş raporların:

Excel

PDF

olarak dışa aktarılmasını sağla.

PDF üzerinde:

şirket logosu

şirket adı

rapor başlığı

filtreler

tarih

tablo

toplamlar

bulunsun.

Excel dosyasına ekrandaki filtrelenmiş veriyi aktar.

22. AUDIT LOG

Bu modül kritik önemdedir.

Önemli bütün işlemleri kaydet.

Audit log:

kullanıcı

işlem

modül

kayıt ID

eski veri

yeni veri

tarih/saat

içersin.

Örneğin:

"Ahmet Yılmaz stok miktarını 500 → 450 değiştirdi."

Audit kayıtları normal kullanıcı tarafından değiştirilememeli veya silinememeli.

23. AKTİVİTE TIMELINE

Sipariş, üretim emri ve görev detaylarında timeline oluştur.

Örneğin:

09:00 Sipariş oluşturuldu
09:15 Sipariş onaylandı
09:20 Üretim emri oluşturuldu
09:30 Kesim birimine atandı
10:00 Ahmet görevi kabul etti
10:15 Üretim başladı

24. DOSYA YÖNETİMİ

Supabase Storage kullan.

Dosya eklenebilecek alanlar:

Ürün

Sipariş

Üretim Emri

Görev

Destek:

PDF

Word

Excel

JPG

PNG

Dosya boyutu ve dosya tipi kontrolü yap.

25. YORUM SİSTEMİ

Görev ve üretim emirlerinde yorum alanı oluştur.

Yorum:

kullanıcı

mesaj

tarih

saat

içersin.

26. GLOBAL ARAMA

Header içerisinde global search oluştur.

Arama:

ürün

ürün kodu

sipariş

üretim emri

görev

çalışan

müşteri

tedarikçi

üzerinde çalışsın.

Sonuç seçildiğinde ilgili detay sayfasına yönlendirsin.

27. TABLOLAR

Bütün büyük tablolarda:

arama

filtre

sıralama

pagination

kolon seçme

responsive görünüm

kullan.

Binlerce kayıt geldiğinde bütün veriyi tek seferde browser'a yükleme.

Server-side pagination mantığına uygun geliştir.

28. OTOMATİK KODLAR

Otomatik ve benzersiz kod üret.

Örnek:

Ürün:
PRD-000001

Personel:
PER-000001

Sipariş:
SIP-2026-000001

Üretim:
URE-2026-000001

Görev:
GRV-2026-000001

Müşteri:
MUS-000001

Tedarikçi:
TED-000001

Kod üretimini yalnızca frontend'e bırakma.

Concurrency durumunda duplicate kod oluşmasını database/backend seviyesinde engelle.

29. SİSTEM AYARLARI

Admin için ayarlar ekranı oluştur.

Buradan:

şirket adı

logo

departmanlar

birimler

depolar

kategoriler

ölçü birimleri

roller

yetkiler

bildirim ayarları

yönetilebilsin.

30. DUYURU SİSTEMİ

Admin ve yetkili yöneticiler duyuru yayınlayabilsin.

Duyuru:

başlık

içerik

hedef departman

başlangıç tarihi

bitiş tarihi

önem seviyesi

içersin.

Dashboard üzerinde göster.

31. MOBİL TASARIM

Mobil deneyime özellikle önem ver.

Mobilde alt navigasyon:

Ana Sayfa | Görevler | Üretim | Stok | Bildirimler

olsun.

Sidebar mobilde drawer olarak açılsın.

Tablolar mobilde taşmamalı.

Gerekirse tablo satırlarını mobil kartlara dönüştür.

Formlar dokunmatik kullanım için uygun olsun.

32. VERİTABANI TASARIMI

Normalize edilmiş relational database oluştur.

En az aşağıdaki tabloları değerlendir:

profiles
roles
permissions
role_permissions
departments
units
employees
warehouses
warehouse_locations
product_categories
products
inventory
stock_movements
customers
suppliers
orders
order_items
production_orders
tasks
notifications
approvals
comments
attachments
announcements
audit_logs
activity_logs

Foreign key ilişkilerini düzgün kur.

created_at ve updated_at alanlarını gerekli tablolarda kullan.

Gerekli tablolarda created_by kullan.

Soft delete gereken yapılarda deleted_at kullan.

Index gerektiren alanlara index oluştur.

33. VERİ BÜTÜNLÜĞÜ

Sadece frontend validation'a güvenme.

Database seviyesinde de:

foreign key

unique constraint

check constraint

NOT NULL

RLS

kullan.

Negatif stok gibi geçersiz durumları backend/database seviyesinde engelle.

Stok hareketleri mümkünse transaction mantığıyla çalışsın.

34. AUDIT VE GÜVENLİK

Kullanıcı frontend üzerinden request değiştirerek başka departmanın verilerine ulaşamamalı.

RLS politikalarını gerçek kullanıcı rolleri ve organizasyon yapısına göre oluştur.

Admin yetkisini yalnızca frontend değişkenine bağlama.

Service role key kesinlikle frontend'e koyma.

Environment variable kullan.

35. HATA YÖNETİMİ

Kullanıcıya anlaşılır Türkçe hata mesajları göster.

Örneğin:

Yanlış:
"Database error"

Doğru:
"Bu işlem için yeterli stok bulunmuyor."

Loading state, empty state ve error state tasarımlarını bütün önemli ekranlarda oluştur.

Toast notification kullan.

36. DEMO / SEED DATA

Arayüzün test edilebilmesi için örnek fabrika verileri oluştur.

Örnek:

departmanlar

çalışanlar

ürünler

depolar

müşteriler

siparişler

üretim emirleri

görevler

stok hareketleri

bildirimler

Ancak demo verileri gerçek verilerden kolayca ayrılabilir veya temizlenebilir yap.

37. GELECEK OTOMASYON ENTEGRASYONU

Şu anda PLC, SCADA veya fiziksel makine entegrasyonu YAPMA.

Ancak yazılım mimarisini gelecekte:

PLC
SCADA
OPC UA
MQTT
REST API
IoT Gateway

entegrasyonları eklenebilecek şekilde modüler tasarla.

Gelecekte makine verileri için ayrı modül eklenebilmesine imkan bırak.

Mevcut üretim, stok ve kullanıcı kodunu makine entegrasyonuna bağımlı hale getirme.

38. KULLANICI AKIŞI

Temel operasyon örneği:

Müşteri siparişi oluşturulur.

↓

Sipariş yönetici tarafından onaylanır.

↓

Stok kontrol edilir.

↓

Ürün stokta yeterliyse sipariş hazırlanır.

↓

Ürün stokta yetersizse üretim ihtiyacı ortaya çıkar.

↓

Üretim emri oluşturulur.

↓

Üretim Müdürüne bildirim gönderilir.

↓

Üretim Müdürü ilgili birime atama yapar.

↓

Birim sorumlusu personele görev atar.

↓

Personelin bildirim merkezine yeni görev düşer.

↓

Personel görevi başlatır.

↓

Görev durumu "Devam Ediyor" olur.

↓

Üretim tamamlanır.

↓

Görev tamamlanır.

↓

Üretim emri tamamlanır.

↓

Üretilen ürün mamul stoğuna eklenir.

↓

Sipariş "Hazır" durumuna geçer.

↓

Sevkiyat sonrasında sipariş tamamlanır.

Bu akışın temel yazılım altyapısını oluştur.

39. ÖNEMLİ GELİŞTİRME KURALI

Projeyi yalnızca güzel görünen bir frontend demo olarak üretme.

Her modül mümkün olduğunca gerçek Supabase verileri ile çalışmalıdır.

Mock data kullanımını minimumda tut.

Bir buton arayüzde görünüyorsa mümkün olduğunca gerçek işlevi olsun.

Çalışmayan dekoratif buton bırakma.

CRUD işlemlerini gerçek database ile bağla.

Rol ve yetkilendirmeyi gerçekten uygula.

40. GELİŞTİRME SIRASI

Projeyi kontrollü şekilde geliştir.

Öncelik sırası:

FAZ 1

Ana layout

Responsive tasarım

Authentication

Database schema

Kullanıcı profilleri

Roller

Yetkilendirme

Departmanlar

Dashboard

FAZ 2

Ürünler

Depolar

Stok

Stok hareketleri

Kritik stok

FAZ 3

Müşteriler

Tedarikçiler

Siparişler

FAZ 4

Üretim emirleri

Görev sistemi

İş atama

Bildirimler

Onay sistemi

FAZ 5

Personel

Takvim

Dosyalar

Yorumlar

Timeline

FAZ 6

Raporlama

Excel

PDF

Audit log

Global arama

Sistem ayarları

Her fazda mevcut çalışan özellikleri bozmadan ilerle.

SON TALİMAT

Önce mevcut proje yapısını analiz et.

Daha sonra gerekli Supabase database schema ve ilişkilerini planla.

Ardından FAZ 1'den başlayarak sistemi oluştur.

Bütün uygulamanın dili Türkçe olsun.

Kod isimlendirmelerinde standart İngilizce isimlendirme kullanılabilir.

UI profesyonel Türkçe fabrika yönetim yazılımı görünümünde olsun.

Lorem ipsum kullanma.

Gerçekçi fabrika örnek verileri kullan.

Gelecekte sistem büyütüleceği için kısa vadeli hack çözümler yerine sürdürülebilir mimari tercih et.

Öncelikle FAZ 1'i eksiksiz ve çalışan şekilde tamamla.

FAZ 1 tamamlandıktan sonra diğer fazları kendiliğinden rastgele geliştirmeye çalışma. Mevcut yapıyı koru ve sonraki geliştirme talimatına hazır hale getir.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://factory-forge-os.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0008219d-ee9a-4631-a21c-eb1ca71bda82).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
