function drawHeader(doc) {
    // Kop Surat
    doc.setFontSize(14);
    doc.setFont("times", "bold");
    doc.text('YAYASAN PENDIDIKAN "PARIASDHITA"', 105, 20, {align: "center"});
    doc.text("TK PRATAMA", 105, 28, {align: "center"});
    doc.setFontSize(10);
    doc.setFont("times", "normal");
    doc.text("Jl. Petemon Kali II/1, Kec. Sawahan, Kota Surabaya", 105, 34, {align: "center"});

    doc.setLineWidth(0.5);
    doc.line(14, 40, 196, 40);
}

const TableStyle = {
    theme: "grid",
      styles: {
        font: 'times',
        textColor: [0, 0, 0],      // Teks hitam
        lineColor: [0, 0, 0],      // Garis hitam
        fillColor: [255, 255, 255] // Latar putih
      },
      headStyles: {
        fillColor: [255, 255, 255], // Header latar putih
        textColor: [0, 0, 0],       // Teks header hitam
        lineColor: [0, 0, 0],        // Garis header hitam
        lineWidth: 0.1,              // Lebar garis
        halign: 'center'
      },
      bodyStyles: {
        fillColor: [255, 255, 255], // Isi latar putih
        textColor: [0, 0, 0],       // Teks isi hitam
        lineColor: [0, 0, 0]        // Garis isi hitam
      }
};
module.exports = {
    drawHeader,
    TableStyle
};