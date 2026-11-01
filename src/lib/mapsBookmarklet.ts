// Botão de favoritos "Enviar para INOVA": roda no Google Maps do próprio usuário, rola a lista da pesquisa,
// abre cada empresa para ler o telefone (a lista não mostra em lanchonete, restaurante…) e manda tudo para
// /prospeccao#maps pela janela que abre (postMessage). Também copia o resultado: se a janela não receber,
// dá para colar no Importador Mágico.
// Fica como texto (não como função) para o build não mexer no código que vai para o favorito.

/** Mensagem que a plataforma recebe */
export type MapsPayload = {
  type: 'inova-maps'; query: string;
  places: { name: string; phone: string; address: string; website: string; rating: number | null; category: string }[];
};

const SOURCE = `
(async () => {
  if (window.__inovaMaps) return;
  window.__inovaMaps = 1;
  const ORIGIN = '__ORIGIN__';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (s, el = document) => el.querySelector(s);
  const norm = (s) => String(s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim();

  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;width:300px;padding:16px;border-radius:14px;background:#0b0d10;color:#fff;font:14px/1.4 system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.4)';
  box.innerHTML = '<b style="color:#bff720">INOVA · Prospecção</b><p id="iv-s" style="margin:8px 0 12px">Começando…</p><div id="iv-b" style="display:flex;gap:8px"></div>';
  document.body.appendChild(box);
  const status = (t) => { $('#iv-s', box).textContent = t; };
  const btn = (label, primary, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'flex:1;padding:8px 10px;border-radius:999px;border:1px solid ' + (primary ? '#bff720' : '#555') + ';background:' + (primary ? '#bff720' : 'transparent') + ';color:' + (primary ? '#0b0d10' : '#fff') + ';font-weight:600;cursor:pointer';
    b.onclick = fn;
    $('#iv-b', box).appendChild(b);
    return b;
  };
  let stop = false;
  const close = () => { box.remove(); window.__inovaMaps = 0; };
  const stopBtn = btn('Parar', false, () => { stop = true; });

  /** Lê a ficha aberta da empresa */
  const readPlace = () => {
    const tel = $('button[data-item-id^="phone:tel:"]');
    const addr = $('button[data-item-id="address"]');
    const site = $('a[data-item-id="authority"]');
    const rating = $('div.F7nice span[aria-hidden="true"]');
    return {
      name: ($('h1.DUwDvf') || $('h1'))?.textContent?.trim() || '',
      // "phone:tel:024999…" → só dígitos, sem o 0 da operadora
      phone: tel ? tel.getAttribute('data-item-id').replace(/\\D/g, '').replace(/^0+/, '') : '',
      address: addr ? (addr.getAttribute('aria-label') || addr.textContent || '').replace(/^[^:]*:\\s*/, '').trim() : '',
      website: site ? site.href : '',
      rating: rating ? Number(rating.textContent.replace(',', '.')) || null : null,
      category: $('button.DkEaL')?.textContent?.trim() || '',
    };
  };

  const query = ($('#searchboxinput') || $('input[name="q"]'))?.value || '';
  const places = [];
  // Nome sem o "·Link acessado" que o Maps põe nas já abertas; id do Google tirado do link
  const cleanName = (a) => (a.getAttribute('aria-label') || '').split('·')[0].trim();
  const keyOf = (a) => (a.href.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/) || [])[1] || cleanName(a);
  const feedNow = () => $('div[role="feed"]');
  /** Espera a lista aparecer; se a ficha tomou o lugar dela (janela estreita), volta */
  const getFeed = async () => {
    for (let t = 0; t < 40; t++) {
      const f = feedNow();
      if (f && f.querySelector('a.hfpxzc')) return f;
      if (t === 0 && location.pathname.includes('/maps/place/')) history.back();
      await sleep(250);
    }
    return null;
  };
  /** Acha o link da empresa na lista, rolando para carregar mais */
  const findLink = async (feed, key) => {
    for (let t = 0; t < 30 && !stop; t++) {
      const a = [...feed.querySelectorAll('a.hfpxzc')].find((x) => keyOf(x) === key);
      if (a) return a;
      feed.scrollTop = feed.scrollHeight;
      await sleep(900);
    }
    return null;
  };

  if (!feedNow()) {
    // Página de uma empresa só
    if ($('h1')) places.push(readPlace());
  } else {
    // 1. Rola a lista até o fim (ou até parar de crescer)
    const feed = feedNow();
    let last = 0, still = 0;
    while (!stop && still < 4) {
      feed.scrollTop = feed.scrollHeight;
      await sleep(1200);
      const n = feed.querySelectorAll('a.hfpxzc').length;
      status('Carregando a lista… ' + n + ' empresas');
      if (/final da lista|end of the list/i.test(feed.textContent)) break;
      still = n === last ? still + 1 : 0;
      last = n;
    }
    const items = [];
    for (const a of feed.querySelectorAll('a.hfpxzc')) {
      const key = keyOf(a);
      if (!items.some((x) => x.key === key)) items.push({ key, name: cleanName(a) });
    }
    // No máximo 60 por rodada: com a ficha trocando de lugar com a lista (janela estreita) cada uma leva ~10 s
    items.splice(60);
    // 2. Abre cada empresa e lê a ficha
    for (let i = 0; i < items.length && !stop; i++) {
      const { key, name } = items[i];
      // Com a aba em segundo plano o Maps não desenha a ficha: espera voltar
      while (document.hidden && !stop) { status('Pausado: volte para esta aba para continuar.'); await sleep(500); }
      status('Lendo ' + (i + 1) + ' de ' + items.length + ': ' + name);
      const f = await getFeed();
      const a = f && await findLink(f, key);
      let p = null;
      // Duas tentativas: às vezes o clique chega enquanto a ficha anterior ainda está trocando
      for (let tryN = 0; a && !p && tryN < 2; tryN++) {
        a.scrollIntoView({ block: 'center' });
        a.click();
        for (let t = 0; t < 24; t++) {
          await sleep(250);
          const h = $('h1.DUwDvf');
          if (h && norm(h.textContent) === norm(name)) { await sleep(500); p = readPlace(); break; }
        }
      }
      places.push(p && p.name ? p : { name, phone: '', address: '', website: '', rating: null, category: '' });
      await sleep(600 + Math.random() * 800);
    }
  }

  stopBtn.remove();
  const withPhone = places.filter((p) => p.phone);
  if (!withPhone.length) {
    status(places.length ? 'Nenhuma empresa com telefone nesta pesquisa.' : 'Abra uma pesquisa no Google Maps (ex.: lanchonete em Volta Redonda) e clique de novo.');
    btn('Fechar', false, close);
    return;
  }
  status(withPhone.length + ' de ' + places.length + ' empresas com telefone.' + (stop ? ' (parado no meio)' : ''));
  const payload = { type: 'inova-maps', query, places: withPhone };
  btn('Enviar para a INOVA', true, () => {
    try { navigator.clipboard.writeText(JSON.stringify(payload)); } catch (e) {}
    const w = window.open(ORIGIN + '/prospeccao#maps', '_blank');
    const onMsg = (e) => {
      if (e.origin !== ORIGIN) return;
      if (e.data === 'inova-maps-ready') w && w.postMessage(payload, ORIGIN);
      if (e.data === 'inova-maps-ok') { window.removeEventListener('message', onMsg); status('Enviado! Confira na aba da INOVA.'); }
    };
    window.addEventListener('message', onMsg);
    status('Abrindo a INOVA… Se a lista não aparecer lá, abra o Importador Mágico e cole (Ctrl+V): o resultado já está copiado.');
  });
  btn('Fechar', false, close);
})();
`;

/** Link do favorito, apontando para esta plataforma */
export function mapsBookmarklet(origin: string) {
  const code = SOURCE.replace('__ORIGIN__', origin).replace(/\n\s*/g, '\n').trim();
  return `javascript:${encodeURIComponent(code)}`;
}
