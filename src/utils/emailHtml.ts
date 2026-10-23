/** Prefix the backend recognises: a body that starts with it is sent as HTML instead of escaped plain text. */
export const HTML_MARKER = '<!--html-->';

export const isHtmlBody = (body: string) => body.startsWith(HTML_MARKER);

export const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Body markup without the marker; older plain-text bodies are escaped and keep their line breaks. */
export function bodyToHtml(body: string): string {
  return isHtmlBody(body) ? body.slice(HTML_MARKER.length) : escapeHtml(body).replace(/\n/g, '<br>');
}

/** Removes scripts, frames, event handlers and javascript: links so markup can be shown in the page. */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach((el) => el.remove());
  doc.body.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const value = attr.value.trim().toLowerCase();
      if (attr.name.startsWith('on') || ((attr.name === 'href' || attr.name === 'src') && value.startsWith('javascript:'))) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return doc.body.innerHTML;
}

/** Replaces {{variables}}. In an HTML body the values are escaped so ticket text cannot inject markup. */
export function renderBody(body: string, vars: Record<string, string>): string {
  const html = isHtmlBody(body);
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) =>
    key in vars ? (html ? escapeHtml(vars[key]) : vars[key]) : match,
  );
}

/** The rendered body as HTML for an on-page preview. */
export const previewHtml = (body: string, vars: Record<string, string>) =>
  sanitizeHtml(bodyToHtml(renderBody(body, vars)));
