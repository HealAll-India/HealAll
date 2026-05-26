/**
 * Minimal server-rendered JSON-LD helper.
 *
 * Renders `<script type="application/ld+json">` with the supplied object
 * stringified safely. Used by the landing page and the post-detail page
 * to expose schema.org structured data to crawlers.
 *
 * dangerouslySetInnerHTML is intentional — JSON.stringify already escapes
 * the slash + closing-tag attack vector (`</script>` becomes `<\/script>`
 * after escaping below), and there's no DOM API to set raw text on a
 * `<script>` tag via React props.
 */

interface Props {
  data: unknown;
  id?: string;
}

export function JsonLd({ data, id }: Props) {
  // JSON.stringify can return `undefined` (e.g. for raw undefined / a
  // function / a symbol). Calling .replace on that would throw a
  // TypeError during SSR, taking the whole page render down with it.
  let json: string;
  try {
    const raw = JSON.stringify(data);
    if (!raw) return null;
    json = raw.replace(/</g, "\\u003c");
  } catch {
    return null;
  }
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
