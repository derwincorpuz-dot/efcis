import React, { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X, FileSignature } from "lucide-react";

const fmt = (n) => {
  if (n === undefined || n === null || Number.isNaN(Number(n))) return "";
  return Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function calcLoanProceeds({ approved, terms }) {
  const A = Number(approved) || 0;
  const t = Number(terms) || 0;
  const rate = t === 60 ? 0.20 : t === 80 ? 0.22 : 0;
  const totalWithInterest = A + A * rate;
  const daily = t > 0 ? totalWithInterest / t : 0;
  const insurance = A * 0.01;
  let notarial = 0;
  if (A >= 5000 && A <= 50000) notarial = 150;
  else if (A <= 100000) notarial = 250;
  else if (A <= 300000) notarial = 300;
  const released = A - insurance - notarial;
  return { rate, totalWithInterest, daily, insurance, notarial, released };
}

// Simple inline blank — shows underlined value or just an underscore line
const Blank = ({ children, w = "auto", strong = false }) => (
  <span
    style={{
      borderBottom: "1px solid #0F172A",
      display: "inline-block",
      minWidth: w === "auto" ? 80 : w,
      padding: "0 4px",
      lineHeight: "1.1em",
      fontWeight: strong ? 700 : 500,
    }}
  >
    {children || "\u00A0"}
  </span>
);

export default function ContractSOAModal({ open, onClose, application }) {
  const printRef = useRef(null);
  if (!application) return null;
  const d = application.data || {};
  const term = Number(d.approved_terms || 0);
  const p = calcLoanProceeds({ approved: d.approved_amount, terms: term });
  const fullName = [d.first_name, d.middle_name, d.surname, d.suffix].filter(Boolean).join(" ");
  const startDate = d.release_date ? new Date(d.release_date) : null;
  const lastDate = (startDate && term > 0) ? new Date(startDate.getTime() + term * 86400000) : null;
  const today = new Date();

  const termsWord = term === 60 ? "Sixty (60)" : term === 80 ? "Eighty (80)" : `${term}`;

  const rows = [];
  if (startDate && term > 0) {
    for (let i = 1; i <= term; i++) {
      const dt = new Date(startDate.getTime());
      dt.setDate(dt.getDate() + i);
      rows.push({ day: i, date: dt.toLocaleDateString(), amount: p.daily });
    }
  }

  const handlePrint = () => {
    const html = printRef.current?.innerHTML;
    if (!html) return;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Kasunduan / Promissory Note — ${application.control_no}</title>
      <style>
        @page { size: A4; margin: 14mm; }
        body{font-family:'Times New Roman', serif; color:#000; font-size:11pt; line-height:1.35;}
        .doc{max-width: 760px; margin:0 auto;}
        h1.title{text-align:center; font-size:13pt; font-weight:bold; margin:0 0 12px; letter-spacing:0.5px;}
        p{margin: 6px 0; text-align: justify;}
        ol{padding-left: 22px;}
        ol > li{margin-bottom: 8px; text-align: justify;}
        .blank{border-bottom: 1px solid #000; display: inline-block; min-width: 80px; padding: 0 4px;}
        .blank.strong{font-weight:700;}
        .sig-row{display:flex; justify-content:space-between; gap:24px; margin-top:30px;}
        .sig-col{flex:1; text-align:center;}
        .sig-line{border-bottom:1px solid #000; height:36px; margin-bottom:4px;}
        .sig-name{font-weight:700; font-size:10pt;}
        .sig-label{font-size:9pt; text-transform:uppercase; letter-spacing:0.5px;}
        .ack{margin-top:18px;}
        table.id-table{width:100%; border-collapse:collapse; margin-top:6px;}
        table.id-table th, table.id-table td{border:1px solid #000; padding:5px 8px; font-size:10pt; text-align:left;}
        .small{font-size:9pt;}
        .soa-table{width:100%; border-collapse:collapse; margin-top:6px;}
        .soa-table th, .soa-table td{border:1px solid #000; padding:4px 6px; font-size:9.5pt; text-align:left;}
        .soa-table th{background:#f1f5f9;}
        .right{text-align:right;}
        .page-break{page-break-before:always;}
      </style></head><body><div class="doc">${html}</div><script>window.onload=()=>setTimeout(()=>window.print(),300);</script></body></html>`);
    w.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="w-[98vw] max-w-3xl lg:max-w-5xl xl:max-w-6xl max-h-[95vh] overflow-y-auto p-0 sm:rounded-2xl">
        <DialogHeader className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 px-5 py-4">
          <DialogTitle className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2 font-heading">
            <FileSignature className="w-5 h-5 text-green-600" />
            Kasunduan / Promissory Note — {application.control_no}
          </DialogTitle>
        </DialogHeader>

        <div className="px-3 sm:px-6 py-4 bg-slate-100 overflow-x-auto">
          <div
            ref={printRef}
            className="bg-white mx-auto p-6 sm:p-10 shadow-md"
            style={{
              maxWidth: 800,
              minWidth: 700,
              fontFamily: "'Times New Roman', serif",
              fontSize: "11pt",
              lineHeight: 1.35,
              color: "#000",
            }}
          >
            <h1 style={{ textAlign: "center", fontWeight: 700, fontSize: "13pt", marginBottom: 14, letterSpacing: 0.5 }}>
              KASUNDUAN / PROMISSORY NOTE
            </h1>

            <p style={{ textAlign: "justify" }}>
              Ang kasulatang ito ay patungkol sa kasunduan sa pagitan ng <b>EASY FINANCE CREDIT INVESTIGATION SERVICES</b> na
              nirerepresenta ni <b>MS. MARY ANN M. COSTIN</b> bilang <b>UNANG PARTIDO / CREDITOR</b> na may Business Address sa
              <b> Landing Road, Brgy. Ibabang Iyam, Lucena City </b>
              at ni Mr. / Ms. <Blank w={260} strong>{fullName}</Blank> bilang <b>IKALAWANG PARTIDO / BORROWER</b> na nakatira
              sa <Blank w={460}>{d.present_address}</Blank>.
            </p>

            <ol style={{ paddingLeft: 22, marginTop: 8 }}>
              <li style={{ textAlign: "justify", marginBottom: 8 }}>
                Ang <b>UNANG PARTIDO</b> ay nagpapautang sa <b>IKALAWANG PARTIDO</b> ng halagang
                {" "}<Blank w={180} strong>{fmt(d.approved_amount)}</Blank> &amp; 00/100 pesos
                (Php <Blank w={120} strong>{fmt(d.approved_amount)}</Blank>) na babayaran nang araw-araw sa loob ng
                {" "}<b>{termsWord}</b> days sa halagang
                {" "}<Blank w={140} strong>{fmt(p.daily)}</Blank> &amp; 00/100 pesos
                (Php <Blank w={100} strong>{fmt(p.daily)}</Blank>) simula
                {" "}<Blank w={140}>{startDate ? startDate.toLocaleDateString() : ""}</Blank> hanggang
                {" "}<Blank w={140}>{lastDate ? lastDate.toLocaleDateString() : ""}</Blank>.
              </li>

              <li style={{ textAlign: "justify", marginBottom: 8 }}>
                Ang <b>UNANG PARTIDO</b> ay magbibigay ng resibo sa tuwing magbabayad ang <b>IKALAWANG PARTIDO</b>. Maaaring
                magbayad ang <b>IKALAWANG PARTIDO</b> sa opisina ng <b>UNANG PARTIDO</b> o sa collector nito.
              </li>

              <li style={{ textAlign: "justify", marginBottom: 8 }}>
                Ang <b>IKALAWANG PARTIDO</b> ay nagkakaloob ng nabanggit na pautang upang gamitin pandagdag puhunan sa
                {" "}<Blank w={260}>{d.bus_type || d.bus_addr}</Blank> at sa pangako ng <b>IKALAWANG PARTIDO</b> na
                magbibigay sya ng kaukulang prenda na sasaad sa perang ipinautang ng <b>UNANG PARTIDO</b>.
              </li>

              <li style={{ textAlign: "justify", marginBottom: 8 }}>
                Ang <b>IKALAWANG PARTIDO</b> ay nauunawaan ang pagbabayad ng kabuuang
                {" "}<Blank w={200} strong>{fmt(p.totalWithInterest)}</Blank> &amp; 00/100 pesos
                (Php <Blank w={120} strong>{fmt(p.totalWithInterest)}</Blank>) sa pagtatapos ng termino ng pautang. Sa
                pangyayari na ang <b>IKALAWANG PARTIDO</b> ay magkaroon ng pagkakautang, ito ay may karagdagang 10% penalty sa
                bawat sumusunod na buwan at karagdagang 10% interest kada buwan na idaragdag sa loan balance kung ito ay
                lalampas sa kanyang maturity date.
              </li>

              <li style={{ textAlign: "justify", marginBottom: 8 }}>
                Si Mr./Mrs. <Blank w={220} strong>{d.comaker1_name}</Blank> na nakatira sa address na
                {" "}<Blank w={260}>{d.comaker1_addr}</Blank> at si
                {" "}<Blank w={220} strong>{d.comaker2_name}</Blank> na nakatira sa address na
                {" "}<Blank w={260}>{d.comaker2_addr}</Blank> ay boluntaryong sumasang-ayon na maging <b>CO-BORROWER</b> ng
                <b> IKALAWANG PARTIDO</b>. Na makikita ang pirma sa ibaba, na inaako at nauunawaan ang responsibilidad nito na
                magbabayad sa pangyayari na hindi mabayaran ng <b>IKALAWANG PARTIDO</b>.
              </li>

              <li style={{ textAlign: "justify", marginBottom: 8 }}>
                Kung ang usapin ito ay umabot sa korte, ang <b>IKALAWANG PARTIDO</b> ay pumapayag na pagsasagawa ng paglilitis
                saan mang korte sa Lucena City o kung saan ang <b>UNANG PARTIDO</b> ay may opisina. Ang lahat ng magagastos ng
                <b> UNANG PARTIDO</b> tulad ng filing fee, attorney's fee, litigation exp. at iba pa na may kinalaman sa
                koleksyon upang mabayaran ito ay sasagutin ng <b>IKALAWANG PARTIDO</b>.
              </li>
            </ol>

            <p style={{ textAlign: "justify", marginTop: 8 }}>
              Ang <b>IKALAWANG PARTIDO</b> ay pumapayag na magbayad at sumunod sa mga nakatalang obligasyon at kondisyon nang
              walang kinakailangang notice o demand. Ang kasulatang ito ay itinala nang ayon sa kapustuhan ng
              <b> MAGKABILANG PARTIDO</b> bilang maging basehan.
            </p>

            <p style={{ textAlign: "justify", marginTop: 8 }}>
              Bilang patunay, Ang <b>MAGKABILANG PARTIDO</b> ay lumagda ngayong
              {" "}<Blank w={180}>{today.toLocaleDateString()}</Blank> sa Lungsod ng Lucena.
            </p>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 24, marginTop: 30 }}>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ borderBottom: "1px solid #000", height: 36, marginBottom: 4 }} />
                <div style={{ fontWeight: 700, fontSize: "10pt" }}>{fullName || "\u00A0"}</div>
                <div style={{ fontSize: "9pt", textTransform: "uppercase", letterSpacing: 0.5 }}>BORROWER / 2nd PARTY</div>
              </div>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontWeight: 700, fontSize: "10pt", marginBottom: 4 }}>EASY FINANCE CREDIT INVESTIGATION SERVICES</div>
                <div style={{ borderBottom: "1px solid #000", height: 24, marginBottom: 4 }} />
                <div style={{ fontWeight: 700, fontSize: "10pt" }}>MARY ANN M. COSTIN</div>
                <div style={{ fontSize: "9pt", textTransform: "uppercase", letterSpacing: 0.5 }}>CREDITOR / 1st PARTY / REPRESENTATIVE</div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 24, marginTop: 30 }}>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ borderBottom: "1px solid #000", height: 36, marginBottom: 4 }} />
                <div style={{ fontWeight: 700, fontSize: "10pt" }}>{d.comaker1_name || "\u00A0"}</div>
                <div style={{ fontSize: "9pt", textTransform: "uppercase", letterSpacing: 0.5 }}>GUARANTOR / CO-BORROWER</div>
              </div>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ borderBottom: "1px solid #000", height: 36, marginBottom: 4 }} />
                <div style={{ fontWeight: 700, fontSize: "10pt" }}>{d.comaker2_name || "\u00A0"}</div>
                <div style={{ fontSize: "9pt", textTransform: "uppercase", letterSpacing: 0.5 }}>GUARANTOR / CO-BORROWER</div>
              </div>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ borderBottom: "1px solid #000", height: 36, marginBottom: 4 }} />
                <div style={{ fontWeight: 700, fontSize: "10pt" }}>{d.witness_name || "\u00A0"}</div>
                <div style={{ fontSize: "9pt", textTransform: "uppercase", letterSpacing: 0.5 }}>WITNESS</div>
              </div>
            </div>

            {/* ACKNOWLEDGEMENT */}
            <h2 style={{ textAlign: "center", fontWeight: 700, fontSize: "12pt", marginTop: 26, marginBottom: 8 }}>
              ACKNOWLEDGEMENT
            </h2>
            <div style={{ fontSize: "10pt" }}>
              <div>REPUBLIC OF THE PHILIPPINES )</div>
              <div>PROVINCE OF <Blank w={220} /> ) S.S.</div>
              <div>CITY OF <Blank w={220} /> )</div>
            </div>

            <p style={{ marginTop: 10, textAlign: "justify" }}>
              Before me, Notary Public, for and in the City/Municipality of <Blank w={240} /> appeared the following person/s, to wit:
            </p>

            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
              <thead>
                <tr>
                  <th style={{ border: "1px solid #000", padding: "5px 8px", fontSize: "10pt", textAlign: "left" }}>NAME</th>
                  <th style={{ border: "1px solid #000", padding: "5px 8px", fontSize: "10pt", textAlign: "left" }}>TYPE OF ID AND NO.</th>
                  <th style={{ border: "1px solid #000", padding: "5px 8px", fontSize: "10pt", textAlign: "left" }}>ISSUED ON/AT/EXP.</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: "1px solid #000", padding: "5px 8px", fontSize: "10pt" }}>{fullName}</td>
                  <td style={{ border: "1px solid #000", padding: "5px 8px", fontSize: "10pt" }}>{[d.id1_type, d.id1_number].filter(Boolean).join(" — ")}</td>
                  <td style={{ border: "1px solid #000", padding: "5px 8px", fontSize: "10pt" }}>&nbsp;</td>
                </tr>
                <tr>
                  <td style={{ border: "1px solid #000", padding: "5px 8px", fontSize: "10pt" }}>{fullName}</td>
                  <td style={{ border: "1px solid #000", padding: "5px 8px", fontSize: "10pt" }}>{[d.id2_type, d.id2_number].filter(Boolean).join(" — ")}</td>
                  <td style={{ border: "1px solid #000", padding: "5px 8px", fontSize: "10pt" }}>&nbsp;</td>
                </tr>
                <tr>
                  <td style={{ border: "1px solid #000", padding: "5px 8px", fontSize: "10pt" }}>{d.comaker1_name || "—"}</td>
                  <td style={{ border: "1px solid #000", padding: "5px 8px", fontSize: "10pt" }}>&nbsp;</td>
                  <td style={{ border: "1px solid #000", padding: "5px 8px", fontSize: "10pt" }}>&nbsp;</td>
                </tr>
                <tr>
                  <td style={{ border: "1px solid #000", padding: "5px 8px", fontSize: "10pt" }}>{d.comaker2_name || "—"}</td>
                  <td style={{ border: "1px solid #000", padding: "5px 8px", fontSize: "10pt" }}>&nbsp;</td>
                  <td style={{ border: "1px solid #000", padding: "5px 8px", fontSize: "10pt" }}>&nbsp;</td>
                </tr>
              </tbody>
            </table>

            <p style={{ marginTop: 10, textAlign: "justify", fontSize: "10pt" }}>
              All known to me and to me known to be the same person/s who executed the foregoing instrument and they acknowledge to me
              that the same is their own free and voluntary acts and deeds. This Promissory Note/Trust Receipt/Loan Agreement consist
              of one page including this acknowledgement.
            </p>

            <p style={{ marginTop: 10 }}>
              WITNESS MY HAND AND SEAL this <Blank w={50} /> day of <Blank w={140} /> 20<Blank w={40} />.
            </p>

            <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontSize: "10pt" }}>
                <div>Doc. No. <Blank w={80} />;</div>
                <div>Page No. <Blank w={80} />;</div>
                <div>Book No. <Blank w={80} />;</div>
                <div>Series of 20 <Blank w={60} />.</div>
              </div>
              <div style={{ textAlign: "center", fontSize: "10pt" }}>
                <div style={{ borderBottom: "1px solid #000", height: 36, width: 220, marginBottom: 4 }} />
                <div style={{ fontWeight: 700 }}>NOTARY PUBLIC</div>
              </div>
            </div>

            {/* SOA second page */}
            <div className="page-break" style={{ pageBreakBefore: "always", marginTop: 30, paddingTop: 20, borderTop: "2px dashed #cbd5e1" }}>
              <h2 style={{ textAlign: "center", fontWeight: 700, fontSize: "12pt", marginBottom: 4 }}>STATEMENT OF ACCOUNT (SOA)</h2>
              <div style={{ textAlign: "center", fontSize: "10pt", marginBottom: 8 }}>
                Control No. <b>{application.control_no}</b> &nbsp;•&nbsp; Borrower: <b>{fullName}</b>
              </div>
              <table className="soa-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "9.5pt", textAlign: "left", background: "#f1f5f9" }}>Day</th>
                    <th style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "9.5pt", textAlign: "left", background: "#f1f5f9" }}>Date</th>
                    <th style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "9.5pt", textAlign: "right", background: "#f1f5f9" }}>Daily Payment</th>
                    <th style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "9.5pt", textAlign: "left", background: "#f1f5f9" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={4} style={{ border: "1px solid #000", padding: 8, textAlign: "center", color: "#94a3b8" }}>No SOA — release date or terms missing.</td></tr>
                  ) : rows.map((r) => (
                    <tr key={r.day}>
                      <td style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "9.5pt" }}>{r.day}</td>
                      <td style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "9.5pt" }}>{r.date}</td>
                      <td style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "9.5pt", textAlign: "right" }}>₱ {fmt(r.amount)}</td>
                      <td style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "9.5pt" }}>Pending</td>
                    </tr>
                  ))}
                </tbody>
                {rows.length > 0 && (
                  <tfoot>
                    <tr style={{ fontWeight: 700, background: "#f8fafc" }}>
                      <td colSpan={2} style={{ border: "1px solid #000", padding: "4px 6px" }}>TOTAL</td>
                      <td style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right" }}>₱ {fmt(p.totalWithInterest)}</td>
                      <td style={{ border: "1px solid #000", padding: "4px 6px" }}>—</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-slate-200 px-5 py-3 flex items-center gap-2 justify-between">
          <Button variant="ghost" onClick={onClose} data-testid="contract-close">
            <X className="w-4 h-4 mr-1.5" /> Close
          </Button>
          <Button onClick={handlePrint} className="efcis-gradient text-white" data-testid="contract-print">
            <Printer className="w-4 h-4 mr-1.5" /> Print / Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
