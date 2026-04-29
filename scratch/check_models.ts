
async function checkModels() {
  try {
    const res = await fetch("http://127.0.0.1:10043/v1/models");
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Failed to fetch models:", e);
  }
}
checkModels();
