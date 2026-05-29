function(instance, properties, context) {
    // Garante que a página esteja no topo para capturar corretamente o elemento
    window.scroll(0, 0);

    instance.publishState('status','Iniciando geração de PDF do elemento...');

    const element = document.getElementById(properties.element_id);
    if (!element) {
        instance.publishState('errors','Elemento não encontrado: ' + properties.element_id);
        return;
    }

    const options = {
        useCORS: true,
        imageTimeout: properties.timeout || 5000,
        scale: properties.scale || window.devicePixelRatio || 2
    };

    const opt = {
        margin: properties.margin_mm || 0,
        filename: properties.filename || 'documento.pdf',
        image: { type: 'jpeg', quality: 1 },
        html2canvas: { useCORS: true, imageTimeout: properties.timeout || 5000, scale: properties.scale || 2 },
        jsPDF: {
            unit: 'mm',
            format: [properties.width_mm || 100, properties.height_mm || 100],
            orientation: properties.width_mm > properties.height_mm ? 'landscape' : 'portrait',
            hotfixes: ["px_scaling"]
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        enableLinks: true
    };

    function uploadContentCallback(err, url) {
        if (url) {
            instance.publishState('element_pdf', url);
            instance.triggerEvent('element');
        } else {
            instance.publishState('errors',"PDF não foi salvo: URL vazia");
        }
    }

    // Função principal para gerar PDF
    async function generate() {
        try {
            // Gera canvas diretamente do elemento visível
            const canvas = await html2canvas(element, options);

            // Usa html2pdf para gerar PDF a partir do canvas
            const pdfAsString = await html2pdf().set(opt).from(canvas).toCanvas().output('datauristring');

            const pdfBase64 = pdfAsString.substring(pdfAsString.indexOf(',') + 1);

            instance.publishState('status','PDF criado com sucesso');

            if (properties.save === true) {
                context.uploadContent(opt.filename, pdfBase64, uploadContentCallback);
            }

            if (properties.download === true) {
                html2pdf().set(opt).from(canvas).save();
            }

            instance.triggerEvent('completed');

        } catch (err) {
            console.error(err);
            instance.publishState('errors', err.message);
            instance.publishState('status','Erro ao gerar PDF');
        }
    }

    generate();
}
