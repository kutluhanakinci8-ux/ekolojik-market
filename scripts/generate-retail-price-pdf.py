#!/usr/bin/env python3
"""Generate PDF: retail prices +10% for both product lists."""
from __future__ import annotations

import sys
from pathlib import Path

from fpdf import FPDF

LIST1 = [
    ("DAA062", "iLiFE doğal deniz yosunu diş macunu", 0.5, 120.4, 145, 145, 290),
    ("EAA022", "YIBEIL çocuk diş macunu (80g)", 0.2, 85.5, 103, 103, 206),
    ("CCC001", "CARICH Diş Fırçası (Çiftli)", 0.2, 69.8, 84, 84, 168),
    ("CCC029", "CARICH Diş Fırçası", 0.5, 197.6, 238, 238, 476),
    ("CBB017", "CARICH el yapımı kömürlü esansiyel yağ sabunu", 0.2, 80.6, 97, 97, 194),
    ("ASF055", "iLiFE deterjan", 0.5, 152.8, 184, 184, 368),
    ("ASA086", "iLiFE Bambu Özlü Bulaşık Sıvısı", 0.5, 239.1, 288, 288, 576),
    ("DAC056", "iLiFE Mutfak Yağ Temizleyici", 0.2, 169.4, 204, 204, 408),
    ("ASF053", "iLiFE çamaşır deterjanı (1KG)", 0.5, 183.5, 221, 221, 442),
    ("ASA017", "iLiFE Çamaşır Deterjanı", 0.5, 183.5, 221, 221, 442),
    ("ASF054", "iLiFE Çamaşır Deterjanı (2KG)", 1, 361.9, 436, 436, 872),
    ("ASF066", "iLiFE Bakteriyostatik Çamaşır Sabunu", 0.2, 61.5, 74, 74, 148),
    ("KLA128", "CARICH Bambu Yüz Mendili", 0.2, 319.6, 385, 385, 770),
    ("CEA069", "CARICH Bambu Cep Mendili", 0.2, 156.1, 188, 188, 376),
    ("CAA038", "CARICH Zencefil Hacim Şampuanı", 0.5, 245.7, 296, 296, 592),
    ("CAB040", "CARICH Zencefil Hacim Saç Kremi", 0.5, 245.7, 296, 296, 592),
    ("DAA109", "iLiFE Canlandırıcı Nemlendirici Duş Jeli", 0.5, 182.6, 220, 220, 440),
    ("YBA045", "YIBEILE Çocuk 2'si 1 Arada Yıkama & Şampuan", 0.5, 239.1, 288, 288, 576),
    ("DAB087", "iLiFE Pembe Aloe Vera Jeli", 0.7, 215, 259, 259, 518),
    ("ASB044", "iLiFE Nemlendirici Aloe Vera Jeli", 0.7, 215, 259, 259, 518),
    ("ASB045", "iLiFE Aloe Vera Jeli", 0.5, 108.8, 131, 131, 262),
    ("CBE034", "CARICH vitamin E Emülsiyonu", 0.5, 141.1, 170, 170, 340),
    ("ASB046", "iLiFE SOD ipek losyonu", 0.7, 120.4, 145, 145, 290),
    ("SAA069", "SEALUXE Yeşil Çay Nemlendirici Peeling", 0.2, 107.9, 130, 130, 260),
    ("CBF015", "CARICH Shea Yağı Nemlendirici El Kremi", 0.2, 61.5, 74, 74, 148),
    ("CBF014", "CARICH Aloe Nemlendirici El Kremi", 0.2, 61.5, 74, 74, 148),
    ("ASB047", "iLiFE Papatya Köpüren El Yıkama", 0.5, 200.1, 241, 241, 482),
    ("DAA108", "iLiFE Aloe Vera Köpüren El Yıkama", 0.5, 200.1, 241, 241, 482),
]

LIST2 = [
    ("CCA016", "CARICH soğuk alg alüminyum içermeyen diş macunu", 1, 185, 370),
    ("NWA052", "Nilrich 20 çeşit vitamin ve mineralli yumuşak çiğnenebilir şekerler", 10, 1470, 2940),
    ("CAA039", "çiçek kokulu şampuan", 1, 345, 690),
    ("CBA052", "CARICH Aroma Duş Jeli", 0.5, 211, 422),
    ("DAB089", "Cilt bakım gliserini", 0.5, 99, 198),
    ("SBJ064", "SEALUXE Aydınlatıcı Temizleme Jeli", 2, 268, 536),
    ("EBB018", "YIBEILE çocuk yulaf özlü vücut sütü", 2, 314, 628),
    ("FPA151", "pinkpoint inci nude ton-up krem", 3, 436, 872),
    ("SBC053", "SEALUXE Aloe Nemlendirici Maske", 2, 407, 814),
    ("LGI019", "Greenleaf 1,25kg Zencefilli Deterjan", 1, 248, 496),
]

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def new_perakende_value(per: float) -> float:
    return per * 1.10


def new_ortak_value(per: float) -> float:
    """Yeni ortak = yeni perakendenin %50'si."""
    return new_perakende_value(per) * 0.50


def fmt_price(v: float) -> str:
    if abs(v - round(v)) < 1e-9:
        return str(int(round(v)))
    return f"{round(v, 1):.1f}".replace(".", ",")


def fmt_num(n: float) -> str:
    if isinstance(n, float) and n != int(n):
        return f"{n:.1f}".replace(".", ",")
    return str(int(n) if n == int(n) else n)


def main() -> None:
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "/opt/cursor/artifacts/perakende-fiyat-guncelleme.pdf")
    out.parent.mkdir(parents=True, exist_ok=True)

    pdf = FPDF(orientation="L", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.add_font("DV", "", FONT)
    pdf.add_font("DV", "B", FONT_B)

    pdf.add_page()
    pdf.set_font("DV", "B", 14)
    pdf.cell(0, 10, "Ekolojik Market — Fiyat güncelleme tablosu", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("DV", size=9)
    pdf.cell(0, 6, "22 Ekim 2026", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    pdf.set_font("DV", "B", 12)
    pdf.cell(0, 8, "1) Sistemdeki fiyat (28 ürün)", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("DV", size=8)
    pdf.cell(0, 5, "Yeni perakende = mevcut perakende × 1,10  |  Yeni ortak = yeni perakende × %50", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    cols1 = [7, 20, 58, 12, 20, 17, 17, 21, 23, 23]
    headers1 = [
        "No", "Kod", "Ürün adı", "PV ($)", "Franchise", "Ortak", "Kupon",
        "Perakende", "Yeni perak.", "Yeni ortak",
    ]
    pdf.set_font("DV", "B", 7)
    for w, h in zip(cols1, headers1):
        pdf.cell(w, 7, h, border=1, align="C")
    pdf.ln()
    pdf.set_font("DV", size=7)
    for i, row in enumerate(LIST1, 1):
        code, name, pv, fr, ort, kup, per = row
        cells = [
            str(i), code, name, fmt_num(pv), fmt_num(fr), fmt_num(ort), fmt_num(kup), fmt_num(per),
            fmt_price(new_perakende_value(per)), fmt_price(new_ortak_value(per)),
        ]
        for w, txt in zip(cols1, cells):
            pdf.cell(w, 6, txt if w > 30 else txt, border=1)
        pdf.ln()

    pdf.ln(6)
    pdf.set_font("DV", "B", 12)
    pdf.cell(0, 8, "2) Tekrar satın alma fiyatı (10 ürün)", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    cols2 = [8, 22, 82, 14, 26, 26, 28, 28]
    headers2 = ["No", "Kod", "Ürün adı", "PV ($)", "Ortak", "Perakende", "Yeni perak.", "Yeni ortak"]
    pdf.set_font("DV", "B", 8)
    for w, h in zip(cols2, headers2):
        pdf.cell(w, 7, h, border=1, align="C")
    pdf.ln()
    pdf.set_font("DV", size=8)
    for i, row in enumerate(LIST2, 1):
        code, name, pv, ort, per = row
        cells = [
            str(i), code, name, fmt_num(pv), fmt_num(ort), fmt_num(per),
            fmt_price(new_perakende_value(per)), fmt_price(new_ortak_value(per)),
        ]
        for w, txt in zip(cols2, cells):
            pdf.cell(w, 7, txt, border=1)
        pdf.ln()

    pdf.output(str(out))
    print(out)


if __name__ == "__main__":
    main()
