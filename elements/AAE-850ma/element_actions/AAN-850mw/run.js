function(instance, properties, context) {
    instance.publishState('status', 'Iniciando geração de PDF...');
    instance.publishState('errors', '');

    if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
        instance.publishState('errors', 'html2canvas ou jsPDF não carregados.');
        return;
    }

    const jsPDFConstructor = window.jspdf.jsPDF;

    (async function gerarPDF() {
        try {
            const element = document.getElementById(properties.element_id);
            if (!element) throw new Error('Elemento não encontrado: ' + properties.element_id);

            instance.publishState('status', 'Renderizando elemento em canvas...');

            const canvas = await html2canvas(element, {
                scale: properties.scale || window.devicePixelRatio || 2,
                useCORS: true,
                allowTaint: false,
                logging: false,
                imageTimeout: 5000
            });

            const imgData = canvas.toDataURL('image/png');

            const PX_TO_MM = 0.264583;
            const imgWidthMM = canvas.width * PX_TO_MM;
            const imgHeightMM = canvas.height * PX_TO_MM;

            const pdfW = properties.width_mm || imgWidthMM;
            const pdfH = properties.height_mm || imgHeightMM;
            const margin = properties.margin_mm || 0;

            const usableWidth = pdfW - 2 * margin;
            const usableHeight = pdfH - 2 * margin;

            const pdf = new jsPDFConstructor({
                orientation: pdfW > pdfH ? 'landscape' : 'portrait',
                unit: 'mm',
                format: [pdfW, pdfH]
            });

            const scale = Math.min(usableWidth / imgWidthMM, usableHeight / imgHeightMM, 1);
            const finalWidth = imgWidthMM * scale;
            const finalHeight = imgHeightMM * scale;
            const xOffset = margin + (usableWidth - finalWidth) / 2;
            const yOffset = margin;

            pdf.addImage(imgData, 'PNG', xOffset, yOffset, finalWidth, finalHeight, undefined, 'FAST');

            const fileName = properties.file_name || 'documento.pdf';

            const pdfBlob = pdf.output('blob');
            const pdfUrl = URL.createObjectURL(pdfBlob);

            const pdfDataUri = pdf.output('datauristring');
            const pdfBase64 = pdfDataUri.split(',')[1];

            instance.publishState('pdf_url', pdfUrl);
            instance.publishState('pdf_base64', pdfDataUri);

            if (properties.open_in_new_tab === true) {
                window.open(pdfUrl, '_blank');
            }

            instance.publishState('status', 'Enviando arquivo para o Bubble...');

            context.uploadContent(fileName, pdfBase64, function(err, uploadedFileUrl) {
                if (err) {
                    console.error(err);
                    instance.publishState('errors', err.message || String(err));
                    instance.publishState('status', 'Erro ao salvar arquivo no Bubble.');
                    return;
                }

                instance.publishState('pdf_file', uploadedFileUrl);
                instance.publishState('pdf_url', uploadedFileUrl);

                instance.publishState('status', 'PDF gerado com sucesso.');
                instance.triggerEvent('completed');
            });

        } catch (err) {
            console.error(err);
            instance.publishState('errors', err.message);
            instance.publishState('status', 'Erro ao gerar PDF.');
        }
    })();
}