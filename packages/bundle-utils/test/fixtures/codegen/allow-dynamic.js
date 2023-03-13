export default async function loadResource(url) {
  const json = await fetch(url).then(response => response.json())
  return { ...json }
}
