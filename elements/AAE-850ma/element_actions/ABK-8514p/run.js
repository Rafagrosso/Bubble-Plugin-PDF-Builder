function(instance, properties, context) {
    instance.publishState('status', 'Iniciando geração de PDF...');
    instance.publishState('errors', '');

    const HTML2CANVAS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

    async function loadScriptOnce(url) {
        if (!document.querySelector(`script[src="${url}"]`)) {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = url;
                s.onload = resolve;
                s.onerror = () => reject(new Error('Erro ao carregar ' + url));
                document.head.appendChild(s);
            });
        }
    }

    async function blobToBase64NoPrefix(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    (async function gerarPDF() {
        try {
            await loadScriptOnce(HTML2CANVAS_CDN);
            await loadScriptOnce(JSPDF_CDN);

            const originalElement = document.getElementById(properties.element_id);
            if (!originalElement) throw new Error('Elemento não encontrado: ' + properties.element_id);

            instance.publishState('status', 'Renderizando elemento em canvas...');

            const canvas = await html2canvas(originalElement, {
                scale: properties.scale || 2,
                useCORS: true,
                allowTaint: false,
                logging: false
            });

            const imgData = canvas.toDataURL('image/png');

            const PX_TO_MM = 0.264583;
            const imgWidthMM = canvas.width * PX_TO_MM;
            const imgHeightMM = canvas.height * PX_TO_MM;

            const pdfW = properties.width_mm || 210;  // formato A4 padrão
            const pdfH = properties.height_mm || 297;
            const margin = properties.margin_mm || 10;

            const usableWidth = pdfW - 2 * margin;
            const usableHeight = pdfH - 2 * margin;

            const jsPDFConstructor = window.jspdf?.jsPDF || window.jsPDF;
            if (!jsPDFConstructor) throw new Error('jsPDF não encontrado.');

            const pdf = new jsPDFConstructor({
                orientation: pdfW > pdfH ? 'landscape' : 'portrait',
                unit: 'mm',
                format: [pdfW, pdfH]
            });

            // 🔹 Escala proporcional sem distorcer
            const scale = Math.min(usableWidth / imgWidthMM, 1);
            const finalWidth = imgWidthMM * scale;
            const finalHeight = imgHeightMM * scale;

            let yOffset = margin;
            let remainingHeight = finalHeight;

            // 🔹 Quebra automática em páginas
            const pageHeightMM = usableHeight;
            const pageHeightPx = (pageHeightMM / PX_TO_MM) / scale;

            let position = 0;
            while (remainingHeight > 0) {
                const pageCanvas = document.createElement('canvas');
                const pageCtx = pageCanvas.getContext('2d');
                pageCanvas.width = canvas.width;
                pageCanvas.height = Math.min(pageHeightPx, canvas.height - position);

                pageCtx.drawImage(
                    canvas,
                    0, position,
                    canvas.width, pageCanvas.height,
                    0, 0,
                    canvas.width, pageCanvas.height
                );

                const pageData = pageCanvas.toDataURL('image/png');
                const pageHeightScaled = (pageCanvas.height * PX_TO_MM) * scale;

                if (position > 0) pdf.addPage();
                pdf.addImage(pageData, 'PNG', margin, margin, finalWidth, pageHeightScaled, undefined, 'FAST');

                position += pageCanvas.height;
                remainingHeight -= pageHeightScaled;
            }

            const blob = pdf.output('blob');
            const blobUrl = URL.createObjectURL(blob);

            window.open(blobUrl, '_blank');
            instance.publishState('status', 'PDF aberto em nova aba.');

            if (properties.save === true) {
                const base64 = await blobToBase64NoPrefix(blob);
                context.uploadContent(
                    (properties.filename || 'documento') + '.pdf',
                    base64,
                    (err, url) => {
                        if (err) instance.publishState('errors', 'Falha ao salvar no servidor.');
                        else {
                            instance.publishState('element_pdf', url);
                            instance.publishState('status', 'PDF salvo com sucesso.');
                            instance.triggerEvent('element');
                        }
                    }
                );
            }

            instance.triggerEvent('completed');

        } catch (err) {
            console.error(err);
            instance.publishState('errors', err.message);
            instance.publishState('status', 'Erro ao gerar PDF.');
        }
    })();
}
