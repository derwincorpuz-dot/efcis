import React, { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X, FileSignature, FileSpreadsheet } from "lucide-react";

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

const Bl = ({ children, w = 120, strong = false }) => (
  <span style={{
    borderBottom: "1px solid #000",
    display: "inline-block",
    minWidth: w,
    padding: "0 4px",
    lineHeight: "1.1em",
    fontWeight: strong ? 700 : 500,
  }}>
    {children || "\u00A0"}
  </span>
);

function openPrintWindow(title, bodyHtml, extraStyles = "") {
  const w = window.open("", "_blank", "width=900,height=900");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${title}</title>
    <style>
      @page { size: 8.5in 14in; margin: 0.5in; }
      body{font-family:'Times New Roman', serif; color:#000; font-size:11pt; line-height:1.4; margin:0;}
      .doc{max-width: 7.5in; margin:0 auto;}
      h1.title{text-align:center; font-size:14pt; font-weight:bold; margin:0 0 14px;}
      p{margin: 6px 0; text-align: justify;}
      ul.bullets{padding-left: 22px; list-style: disc;}
      ul.bullets > li{margin-bottom: 10px; text-align: justify;}
      .blank{border-bottom: 1px solid #000; display: inline-block; min-width: 80px; padding: 0 4px;}
      .sig-row{display:flex; justify-content:space-between; gap:24px; margin-top:30px;}
      .sig-col{flex:1; text-align:center;}
      .sig-line{border-bottom:1px solid #000; height:36px; margin-bottom:4px;}
      .sig-name{font-weight:700; font-size:10pt;}
      .sig-label{font-size:9pt; text-transform:uppercase; letter-spacing:0.5px; font-weight:700;}
      table.id-table{width:100%; border-collapse:collapse; margin-top:6px;}
      table.id-table th, table.id-table td{border:1px solid #000; padding:6px 8px; font-size:10pt; text-align:left;}
      table.id-table th{background:#f1f5f9;}
      .right{text-align:right;}
      ${extraStyles}
    </style></head><body><div class="doc">${bodyHtml}</div>
    <script>window.onload=()=>setTimeout(()=>window.print(),300);</script>
    </body></html>`);
  w.document.close();
}

export default function ContractSOAModal({ open, onClose, application }) {
  const contractRef = useRef(null);
  const soaRef = useRef(null);
  if (!application) return null;
  const d = application.data || {};
  const term = Number(d.approved_terms || 0);
  const p = calcLoanProceeds({ approved: d.approved_amount, terms: term });
  const fullName = [d.first_name, d.middle_name, d.surname, d.suffix].filter(Boolean).join(" ");
  const startDate = d.release_date ? new Date(d.release_date) : null;
  const lastDate = (startDate && term > 0) ? new Date(startDate.getTime() + term * 86400000) : null;
  const today = new Date();

  const rows = [];
  if (startDate && term > 0) {
    for (let i = 1; i <= term; i++) {
      const dt = new Date(startDate.getTime());
      dt.setDate(dt.getDate() + i);
      rows.push({ day: i, date: dt.toLocaleDateString(), amount: p.daily });
    }
  }

  const printContract = () => openPrintWindow(`Kasunduan / Promissory Note — ${application.control_no}`, contractRef.current?.innerHTML || "");
  const printSOA = () => openPrintWindow(`SOA — ${application.control_no}`, soaRef.current?.innerHTML || "");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[98vw] max-w-3xl lg:max-w-5xl xl:max-w-6xl max-h-[95vh] overflow-y-auto p-0 sm:rounded-2xl">
        <DialogHeader className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 px-5 py-4">
          <DialogTitle className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2 font-heading">
            <FileSignature className="w-5 h-5 text-green-600" />
            Contract & SOA — {application.control_no}
          </DialogTitle>
        </DialogHeader>

        <div className="px-3 sm:px-6 py-4 bg-slate-100 overflow-x-auto">
          {/* CONTRACT (Legal 8.5x14in) */}
          <div
            ref={contractRef}
            className="bg-white mx-auto p-6 sm:p-10 shadow-md mb-6"
            style={{
              maxWidth: 760,
              fontFamily: "'Times New Roman', serif",
              fontSize: "11pt",
              lineHeight: 1.4,
              color: "#000",
            }}
          >
            <h1 className="title" style={{ textAlign: "center", fontWeight: 700, fontSize: "14pt", marginBottom: 14 }}>
              Kasunduan / Promissory Note
            </h1>

            <p style={{ textAlign: "justify" }}>
              Ang kasulatang ito ay patungkol sa kasunduan sa pagitan ng <b>Easy Finance Credit Investigation Services</b> na
              nirerepresenta ni <b>Ms. Mary Ann M. Costin</b> bilang unang partido (creditor) na may business address sa
              <b> LANDING ROAD, BRGY. IBABANG IYAM, LUCENA CITY </b>
              at ni Mr. &amp; Mrs. <Bl w={360} strong>{fullName}</Bl> Bilang ikalawang partido (borrower) na nakatira sa
              Brgy, <Bl w={360}>{d.present_address}</Bl>.
            </p>

            <ul className="bullets" style={{ paddingLeft: 22, marginTop: 10, listStyle: "disc" }}>
              <li style={{ marginBottom: 10, textAlign: "justify" }}>
                Ang <b>unang partido</b> ay nagpautang sa <b>ikalawang partido</b> ng halagang
                {" "}<Bl w={240} strong>{fmt(d.approved_amount)}</Bl>,₱<Bl w={120} strong>{fmt(d.approved_amount)}</Bl>{" "}
                na babayaran nang arawan sa loob ng <Bl w={130}>{term} days</Bl> sa halagang
                {" "}<Bl w={200} strong>{fmt(p.daily)}</Bl>,₱<Bl w={100} strong>{fmt(p.daily)}</Bl> simula
                {" "}<Bl w={150}>{startDate ? startDate.toLocaleDateString() : ""}</Bl> hanggang
                {" "}<Bl w={150}>{lastDate ? lastDate.toLocaleDateString() : ""}</Bl>.
              </li>
              <li style={{ marginBottom: 10, textAlign: "justify" }}>
                Ang unang partido ay magbibigay ng resibo sa tuwing magbabayad ang ikalawang partido. Maaaring magbayad ang
                ikalawang partido sa opisina ng unang partido o sa collector nito.
              </li>
              <li style={{ marginBottom: 10, textAlign: "justify" }}>
                Ang ikalawang partido ay napagkalooban ng nabanggit na pautang upang gamitin pandagdag puhunan sa
                {" "}<Bl w={360}>{d.bus_type || d.bus_addr}</Bl> at sa pangako ng ikalawang partido na magbibigay siya ng
                kaukulang prenda na sasapat sa perang ipinautang ng unang partido.
              </li>
              <li style={{ marginBottom: 10, textAlign: "justify" }}>
                Ang ikalawang partido ay nauunawaan ang pagbabayad ng kabuuang
                {" "}<Bl w={260} strong>{fmt(p.totalWithInterest)}</Bl>,₱<Bl w={120} strong>{fmt(p.totalWithInterest)}</Bl>
                {" "}sa pagtatapos ng termino ng pautang. Sa pangyayari na ang ikalawang partido ay magkaroon ng palya sa
                paghuhulog, ito ay may karagdagang 10% penalty sa bawat palyang hulog at karagdagang 10% interest kada buwan na
                idaragdag sa loan balance kung ito ay lalampas sa kanyang maturity date.
              </li>
              <li style={{ marginBottom: 10, textAlign: "justify" }}>
                Si Mr. Mrs. <Bl w={320} strong>{d.comaker1_name}</Bl> nakatira sa address
                {" "}<Bl w={420}>{d.comaker1_addr}</Bl> at si Mr. Mrs.
                {" "}<Bl w={320} strong>{d.comaker2_name}</Bl> nakatira sa address
                {" "}<Bl w={420}>{d.comaker2_addr}</Bl> ay boluntaryo pumapayag na maging co-borrower ng ikalawang partido.
                Na makikita ang pirma sa ibaba, na inaako at nauunawaan ang responsibility nito na magbabayad sa pagkakataon na
                hindi mabayaran ng ikalawang partido.
              </li>
              <li style={{ marginBottom: 10, textAlign: "justify" }}>
                Kung ang usaping ito ay umabot sa korte, ang ikalawang partido ay pumapayag na ganapin ang paglilitis saan mang
                korte sa Lucena City o kung saan ang unang partido ay may opisina. Ang lahat ng magagastos ng unang partido
                tulad ng filing fee, attorney's fee, litigation exp. at iba pa na may kinalaman sa koleksyon upang mabayaran ito
                ay sasagutin ng ikalawang partido.
              </li>
            </ul>

            <p style={{ marginTop: 10, textAlign: "justify" }}>
              Ang ikalawang partido ay pumapayag na magbayad at sumunod sa mga nakatalang obligasyon at kondisyon nang walang
              kinakailangang notice o demand. Ang kasulatang ito ay itinala naaayon sa kagustuhan ng magkabilang partido bilang
              maging basehan.
            </p>

            <p style={{ marginTop: 10 }}>
              Bilang patunay, Ang Magkabilang Partido ay lumagda ngayong <Bl w={300}>{today.toLocaleDateString()}</Bl> sa
              Lungsod ng Lucena.
            </p>

            <div className="sig-row" style={{ display: "flex", justifyContent: "space-between", gap: 24, marginTop: 30 }}>
              <div className="sig-col" style={{ flex: 1, textAlign: "center" }}>
                <div className="sig-line" style={{ borderBottom: "1px solid #000", height: 36, marginBottom: 4 }}>
                  <div style={{ height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", fontWeight: 700 }}>
                    {fullName || "\u00A0"}
                  </div>
                </div>
                <div className="sig-label" style={{ fontSize: "9pt", fontWeight: 700 }}>BORROWER / 2ND PARTY</div>
              </div>
              <div className="sig-col" style={{ flex: 1, textAlign: "center" }}>
                <div className="sig-line" style={{ borderBottom: "1px solid #000", height: 36, marginBottom: 4, paddingTop: 14, fontWeight: 700 }}>
                  MARY ANN M. COSTIN
                </div>
                <div className="sig-label" style={{ fontSize: "9pt", fontWeight: 700, textTransform: "uppercase" }}>EASY FINANCE CREDIT INVESTIGATION SERVICES</div>
                <div className="sig-label" style={{ fontSize: "9pt", fontWeight: 700 }}>CREDITOR / 1ST PARTY / REPRESENTATIVE</div>
              </div>
            </div>

            <div className="sig-row" style={{ display: "flex", justifyContent: "space-between", gap: 24, marginTop: 30 }}>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ borderBottom: "1px solid #000", height: 36, marginBottom: 4, paddingTop: 14, fontWeight: 700 }}>{d.comaker1_name || "\u00A0"}</div>
                <div style={{ fontSize: "9pt", fontWeight: 700 }}>CO-MAKER &amp; CO-BORROWER</div>
              </div>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ borderBottom: "1px solid #000", height: 36, marginBottom: 4, paddingTop: 14, fontWeight: 700 }}>{d.comaker2_name || "\u00A0"}</div>
                <div style={{ fontSize: "9pt", fontWeight: 700 }}>CO-MAKER &amp; CO-BORROWER</div>
              </div>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ borderBottom: "1px solid #000", height: 36, marginBottom: 4, paddingTop: 14, fontWeight: 700 }}>{d.witness_name || "\u00A0"}</div>
                <div style={{ fontSize: "9pt", fontWeight: 700 }}>WITNESS</div>
              </div>
            </div>

            <h2 style={{ textAlign: "center", fontWeight: 700, fontSize: "12pt", marginTop: 28 }}>AKNOWLEDGEMENT</h2>
            <div style={{ fontSize: "10pt" }}>
              <div>REPUBLIC OF THE PHILIPPINES )</div>
              <div>PROVINCE OF <Bl w={240} /> ) S.S.</div>
              <div>CITY OF <Bl w={240} /> )</div>
            </div>
            <p style={{ marginTop: 10, textAlign: "justify", fontSize: "10pt" }}>
              BEFORE ME, NOTARY PUBLIC, FOR AND IN THE CITY/MUNICIPALITY OF <Bl w={220} /> APPEARED THE FOLLOWING PERSON/S, TO WIT:
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
              <thead>
                <tr>
                  <th style={{ border: "1px solid #000", padding: "6px 8px", fontSize: "10pt", textAlign: "left", background: "#f1f5f9" }}>NAME</th>
                  <th style={{ border: "1px solid #000", padding: "6px 8px", fontSize: "10pt", textAlign: "left", background: "#f1f5f9" }}>TYPE OF ID</th>
                  <th style={{ border: "1px solid #000", padding: "6px 8px", fontSize: "10pt", textAlign: "left", background: "#f1f5f9" }}>ID NO.</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: "1px solid #000", padding: "6px 8px", fontSize: "10pt" }}>{fullName}</td>
                  <td style={{ border: "1px solid #000", padding: "6px 8px", fontSize: "10pt" }}>{d.id1_type || ""}</td>
                  <td style={{ border: "1px solid #000", padding: "6px 8px", fontSize: "10pt" }}>{d.id1_number || ""}</td>
                </tr>
                <tr>
                  <td style={{ border: "1px solid #000", padding: "6px 8px", fontSize: "10pt" }}>{fullName}</td>
                  <td style={{ border: "1px solid #000", padding: "6px 8px", fontSize: "10pt" }}>{d.id2_type || ""}</td>
                  <td style={{ border: "1px solid #000", padding: "6px 8px", fontSize: "10pt" }}>{d.id2_number || ""}</td>
                </tr>
                <tr>
                  <td style={{ border: "1px solid #000", padding: "6px 8px", fontSize: "10pt" }}>{d.comaker1_name || ""}</td>
                  <td style={{ border: "1px solid #000", padding: "6px 8px", fontSize: "10pt" }}>&nbsp;</td>
                  <td style={{ border: "1px solid #000", padding: "6px 8px", fontSize: "10pt" }}>&nbsp;</td>
                </tr>
                <tr>
                  <td style={{ border: "1px solid #000", padding: "6px 8px", fontSize: "10pt" }}>{d.comaker2_name || ""}</td>
                  <td style={{ border: "1px solid #000", padding: "6px 8px", fontSize: "10pt" }}>&nbsp;</td>
                  <td style={{ border: "1px solid #000", padding: "6px 8px", fontSize: "10pt" }}>&nbsp;</td>
                </tr>
              </tbody>
            </table>
            <p style={{ marginTop: 10, textAlign: "justify", fontSize: "10pt" }}>
              All known to me and to me known to be the same perons/s who executed the foregoing instrument and they acknowledge to
              me that the same is their own free and voluntary acts and deeds. This Promisory Note/Trust Receipt/Loan Agreement
              consist of one page including this acknowledgement.
            </p>
            <p style={{ marginTop: 10 }}>
              WITNESS MY HAND AND SEAL this <Bl w={50} /> day of <Bl w={140} /> 20<Bl w={40} />.
            </p>
            <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontSize: "10pt" }}>
                <div>Doc. No. <Bl w={80} />;</div>
                <div>Page No. <Bl w={80} />;</div>
                <div>Book No. <Bl w={80} />;</div>
                <div>Series of 20 <Bl w={60} />.</div>
              </div>
              <div style={{ fontSize: "10pt", fontWeight: 700, marginTop: 30 }}>NOTARY PUBLIC</div>
            </div>
          </div>

          {/* SOA (Legal 8.5x14in) */}
          <div
            ref={soaRef}
            className="bg-white mx-auto p-6 sm:p-10 shadow-md"
            style={{
              maxWidth: 760,
              fontFamily: "'Times New Roman', serif",
              fontSize: "11pt",
              lineHeight: 1.4,
              color: "#000",
            }}
          >
            <h1 className="title" style={{ textAlign: "center", fontWeight: 700, fontSize: "14pt", marginBottom: 6 }}>
              STATEMENT OF ACCOUNT (SOA)
            </h1>
            <div style={{ textAlign: "center", fontSize: "10pt", marginBottom: 12 }}>
              <div><b>Easy Finance Credit Investigation Services</b></div>
              <div>Landing Road, Brgy. Ibabang Iyam, Lucena City</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: "10pt", marginBottom: 12 }}>
              <div><b>Control No.:</b> {application.control_no}</div>
              <div><b>Borrower:</b> {fullName}</div>
              <div><b>Contact:</b> {d.contact_no || "—"}</div>
              <div><b>Address:</b> {d.present_address || "—"}</div>
              <div><b>Release Date:</b> {d.release_date || "—"}</div>
              <div><b>Approved Amount:</b> ₱ {fmt(d.approved_amount)}</div>
              <div><b>Terms:</b> {term} days</div>
              <div><b>Interest Rate:</b> {(p.rate * 100).toFixed(0)}%</div>
              <div><b>Daily Payment:</b> ₱ {fmt(p.daily)}</div>
              <div><b>Total w/ Interest:</b> ₱ {fmt(p.totalWithInterest)}</div>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ border: "1px solid #000", padding: "5px 6px", fontSize: "10pt", textAlign: "left", background: "#f1f5f9" }}>Day</th>
                  <th style={{ border: "1px solid #000", padding: "5px 6px", fontSize: "10pt", textAlign: "left", background: "#f1f5f9" }}>Date</th>
                  <th style={{ border: "1px solid #000", padding: "5px 6px", fontSize: "10pt", textAlign: "right", background: "#f1f5f9" }}>Daily Payment</th>
                  <th style={{ border: "1px solid #000", padding: "5px 6px", fontSize: "10pt", textAlign: "left", background: "#f1f5f9" }}>Status</th>
                  <th style={{ border: "1px solid #000", padding: "5px 6px", fontSize: "10pt", textAlign: "left", background: "#f1f5f9" }}>Signature</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={5} style={{ border: "1px solid #000", padding: 8, textAlign: "center", color: "#94a3b8" }}>No SOA — release date or terms missing.</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.day}>
                    <td style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "10pt" }}>{r.day}</td>
                    <td style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "10pt" }}>{r.date}</td>
                    <td style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "10pt", textAlign: "right" }}>₱ {fmt(r.amount)}</td>
                    <td style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "10pt" }}>&nbsp;</td>
                    <td style={{ border: "1px solid #000", padding: "4px 6px", fontSize: "10pt" }}>&nbsp;</td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr style={{ fontWeight: 700, background: "#f8fafc" }}>
                    <td colSpan={2} style={{ border: "1px solid #000", padding: "5px 6px" }}>TOTAL</td>
                    <td style={{ border: "1px solid #000", padding: "5px 6px", textAlign: "right" }}>₱ {fmt(p.totalWithInterest)}</td>
                    <td style={{ border: "1px solid #000", padding: "5px 6px" }}>—</td>
                    <td style={{ border: "1px solid #000", padding: "5px 6px" }}>—</td>
                  </tr>
                </tfoot>
              )}
            </table>

            <div style={{ marginTop: 30, display: "flex", justifyContent: "space-between", gap: 40 }}>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ borderBottom: "1px solid #000", height: 36, marginBottom: 4, paddingTop: 14, fontWeight: 700 }}>{fullName}</div>
                <div style={{ fontSize: "9pt", fontWeight: 700 }}>BORROWER'S SIGNATURE</div>
              </div>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ borderBottom: "1px solid #000", height: 36, marginBottom: 4, paddingTop: 14, fontWeight: 700 }}>MARY ANN M. COSTIN</div>
                <div style={{ fontSize: "9pt", fontWeight: 700 }}>AUTHORIZED REPRESENTATIVE</div>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-slate-200 px-5 py-3 flex flex-wrap items-center gap-2 justify-between">
          <Button variant="ghost" onClick={onClose} data-testid="contract-close">
            <X className="w-4 h-4 mr-1.5" /> Close
          </Button>
          <div className="flex gap-2">
            <Button onClick={printSOA} variant="outline" data-testid="soa-print">
              <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Download SOA
            </Button>
            <Button onClick={printContract} className="efcis-gradient text-white" data-testid="contract-print">
              <Printer className="w-4 h-4 mr-1.5" /> Download Contract
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
