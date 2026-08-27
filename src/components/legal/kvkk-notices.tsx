import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const KVKK_TEXT_VERSION = "2026-08-20-v1";

// Yayımdan önce kuruluşun gerçek bilgileriyle değiştirilmelidir.
const DATA_CONTROLLER = {
  name: "[ŞİRKETİN TAM TİCARET UNVANI]",
  address: "[ŞİRKETİN AÇIK ADRESİ]",
  contact: "[KVKK BAŞVURU E-POSTASI / KEP ADRESİ]",
};

const CONSENT_KEY = `fys-kvkk-optional-consent:${KVKK_TEXT_VERSION}`;

export function KvkkNotices() {
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [optionalConsent, setOptionalConsent] = useState(false);

  useEffect(() => {
    setOptionalConsent(window.localStorage.getItem(CONSENT_KEY) === "accepted");
  }, []);

  function changeConsent(accepted: boolean) {
    setOptionalConsent(accepted);
    if (accepted) window.localStorage.setItem(CONSENT_KEY, "accepted");
    else window.localStorage.removeItem(CONSENT_KEY);
  }

  return (
    <>
      <div className="mt-6 space-y-3 border-t pt-4 text-xs text-muted-foreground">
        <p>
          Kişisel verilerinizin işlenmesi hakkında bilgi almak için metinleri inceleyebilirsiniz.
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-2">
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => setNoticeOpen(true)}
          >
            KVKK Aydınlatma Metni
          </button>
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => setConsentOpen(true)}
          >
            Açık Rıza Metni
          </button>
        </div>
        <label className="flex items-start gap-2 leading-relaxed">
          <Checkbox
            className="mt-0.5"
            checked={optionalConsent}
            onCheckedChange={(value) => changeConsent(value === true)}
          />
          <span>
            İsteğe bağlı profil fotoğrafımın uygulama içi kimliklendirme amacıyla işlenmesine açık
            rıza veriyorum. Bu seçim giriş yapmak için zorunlu değildir ve kutu kaldırılarak geri
            alınabilir.
          </span>
        </label>
        <p>Metin sürümü: {KVKK_TEXT_VERSION}</p>
      </div>

      <Dialog open={noticeOpen} onOpenChange={setNoticeOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Çalışan KVKK Aydınlatma Metni</DialogTitle>
            <DialogDescription>
              6698 sayılı Kanun’un 10. maddesi kapsamında bilgilendirme.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm leading-6">
            <section>
              <h3 className="font-semibold">1. Veri sorumlusu</h3>
              <p>
                {DATA_CONTROLLER.name}, {DATA_CONTROLLER.address}
              </p>
              <p>Başvuru ve iletişim: {DATA_CONTROLLER.contact}</p>
            </section>
            <section>
              <h3 className="font-semibold">2. İşlenen kişisel veriler</h3>
              <p>
                Kimlik ve iletişim bilgileri; personel numarası, görev, departman, birim, vardiya ve
                işe giriş bilgileri; kullanıcı hesabı, rol ve yetki bilgileri; uygulama işlem ve
                denetim kayıtları; üretim, stok, bakım, arıza ve görev süreçlerindeki kullanıcı
                hareketleri işlenebilir.
              </p>
            </section>
            <section>
              <h3 className="font-semibold">3. İşleme amaçları</h3>
              <p>
                İş ilişkisinin ve fabrika operasyonlarının yürütülmesi, görev ve yetki yönetimi,
                bilgi güvenliği, iş sürekliliği, denetim ve izlenebilirlik, hukuki yükümlülüklerin
                yerine getirilmesi ve bir hakkın tesisi, kullanılması veya korunması amaçlarıyla
                işlenir.
              </p>
            </section>
            <section>
              <h3 className="font-semibold">4. Hukuki sebepler ve toplama yöntemi</h3>
              <p>
                Veriler; uygulama formları, kullanıcı işlemleri ve yetkili yöneticiler aracılığıyla
                elektronik ortamda toplanır. Kanunlarda açıkça öngörülme, sözleşmenin kurulması veya
                ifası, veri sorumlusunun hukuki yükümlülüğü, bir hakkın
                tesisi/kullanılması/korunması ve temel haklara zarar vermemek kaydıyla meşru menfaat
                hukuki sebeplerine dayanılır. Yalnızca zorunlu olmayan profil fotoğrafı, ayrı ve
                isteğe bağlı açık rızaya dayanır.
              </p>
            </section>
            <section>
              <h3 className="font-semibold">5. Aktarım</h3>
              <p>
                Veriler; yetkili şirket yöneticileri ve görevli çalışanlarla, hukuken yetkili kamu
                kurumlarıyla ve yalnızca hizmetin sunulması için gerekli ölçüde barındırma, kimlik
                doğrulama ve teknik destek sağlayıcılarıyla amaçla sınırlı olarak paylaşılabilir.
                Yurt dışı aktarım bulunuyorsa kullanılan altyapı ve Kanun’un 9. maddesindeki aktarım
                mekanizması şirket tarafından ayrıca somutlaştırılmalıdır.
              </p>
            </section>
            <section>
              <h3 className="font-semibold">6. İlgili kişinin hakları</h3>
              <p>
                Kanun’un 11. maddesi kapsamında verilerinizin işlenip işlenmediğini öğrenme, bilgi
                talep etme, amacına uygun kullanımı öğrenme, aktarılan üçüncü kişileri bilme, eksik
                veya yanlış verilerin düzeltilmesini isteme, şartları varsa silme/yok etme isteme,
                otomatik analiz sonucuna itiraz etme ve hukuka aykırı işleme nedeniyle zararın
                giderilmesini talep etme haklarına sahipsiniz. Başvurularınızı yukarıdaki iletişim
                kanalına iletebilirsiniz.
              </p>
            </section>
            <p className="text-xs text-muted-foreground">Metin sürümü: {KVKK_TEXT_VERSION}</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={consentOpen} onOpenChange={setConsentOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>İsteğe Bağlı Açık Rıza Metni</DialogTitle>
            <DialogDescription>
              Bu rıza uygulamaya giriş veya çalışma ilişkisinin yürütülmesi için zorunlu değildir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm leading-6">
            <p>
              KVKK Aydınlatma Metni’ni inceledim. Zorunlu olmayan profil fotoğrafımın çalışanların
              uygulama içinde birbirini tanıyabilmesi ve kullanıcı hesabımın görsel olarak
              kişiselleştirilmesi amaçlarıyla kaydedilmesine, görüntülenmesine ve bu amaçlarla
              sınırlı olarak yetkili uygulama kullanıcılarına gösterilmesine özgür irademle açık
              rıza veriyorum.
            </p>
            <p>
              Rıza vermemenin uygulamaya girişe veya temel işlevlere etkisi yoktur. Rızamı giriş
              ekranındaki kutuyu kaldırarak ve veri sorumlusuna başvurarak her zaman geri
              alabilirim. Geri alma, önceki hukuka uygun işlemleri etkilemez.
            </p>
            <Button
              type="button"
              variant={optionalConsent ? "outline" : "default"}
              onClick={() => changeConsent(!optionalConsent)}
            >
              {optionalConsent ? "Açık rızayı geri al" : "İsteğe bağlı açık rıza ver"}
            </Button>
            <p className="text-xs text-muted-foreground">Metin sürümü: {KVKK_TEXT_VERSION}</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
