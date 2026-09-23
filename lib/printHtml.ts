/**
 * Imprime un document HTML complet sans ouvrir de popup.
 *
 * `window.open("", "_blank")` echoue dans deux cas frequents ici :
 *  - apres un `await` (l'impression du ticket suit l'appel reseau de
 *    l'encaissement), le geste utilisateur a expire et Chrome bloque le
 *    popup : `window.open` renvoie `null` et l'impression est perdue en
 *    silence ;
 *  - dans la PWA installee (mode standalone), il n'y a pas d'onglets, donc
 *    pas de fenetre a ouvrir.
 *
 * Un iframe cache n'a aucune de ces limites : il imprime aussi bien apres un
 * await que dans l'app installee.
 */
type PrintHtmlOptions = {
  /** Largeur du rouleau ; la hauteur est calculee a partir du contenu. */
  paperWidthMm?: number;
  marginMm?: number;
};

export function printHtmlDocument(html: string, options: PrintHtmlOptions = {}): void {
  if (typeof document === "undefined") return;

  const paperWidthMm = options.paperWidthMm;
  const marginMm = options.marginMm ?? 4;
  const contentWidthMm = paperWidthMm === undefined ? undefined : paperWidthMm - marginMm * 2;

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("tabindex", "-1");
  frame.style.cssText =
    "position:fixed;left:-10000px;top:0;height:0;border:0;visibility:hidden;";
  frame.style.width = contentWidthMm === undefined ? "0" : `${contentWidthMm}mm`;

  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    frame.remove();
  };

  frame.onload = async () => {
    const win = frame.contentWindow;
    const doc = frame.contentDocument;
    if (!win || !doc) {
      remove();
      return;
    }

    // L'apercu d'impression est asynchrone (surtout sur Android) : retirer
    // l'iframe trop tot annulerait le travail. On attend afterprint, avec un
    // filet de securite si l'evenement n'arrive jamais.
    win.addEventListener("afterprint", remove, { once: true });
    window.setTimeout(remove, 60_000);

    try {
      if (paperWidthMm !== undefined && contentWidthMm !== undefined) {
        // La largeur de mesure doit etre identique a la largeur imprimable.
        // flow-root inclut aussi les marges des derniers elements du ticket.
        const layoutStyle = doc.createElement("style");
        layoutStyle.textContent = `
          html, body {
            box-sizing: border-box !important;
            width: ${contentWidthMm}mm !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
          }
          body { display: flow-root !important; }
        `;
        doc.head.appendChild(layoutStyle);

        await doc.fonts.ready;
        await Promise.all(Array.from(doc.images, (image) => image.decode().catch(() => {})));
        if (removed) return;

        const heightPx = Math.max(doc.body.getBoundingClientRect().height, doc.body.scrollHeight);
        // CSS utilise 96 px/pouce. Un demi-millimetre couvre les arrondis
        // du moteur d'impression sans creer une longue fin de page vide.
        const heightMm = Math.ceil((heightPx * 25.4 / 96 + marginMm * 2 + 0.5) * 10) / 10;
        const pageStyle = doc.createElement("style");
        pageStyle.textContent = `@page { size: ${paperWidthMm}mm ${heightMm}mm; margin: ${marginMm}mm; }`;
        doc.head.appendChild(pageStyle);
      }

      win.focus();
      win.print();
    } catch {
      remove();
    }
  };

  // srcdoc plutot que document.write : onload attend alors le decodage des
  // images (logo et QR sont des data URI) avant de declencher l'impression.
  frame.srcdoc = html;
  document.body.appendChild(frame);
}
