const search = document.querySelector("[data-archive-search]");
const archiveData = document.querySelector("#archive-data");

if (search && archiveData) {
  const records = JSON.parse(archiveData.textContent);
  const cards = [...document.querySelectorAll("[data-search-item]")];
  search.addEventListener("input", () => {
    const query = search.value.trim().toLocaleLowerCase();
    cards.forEach((card, index) => {
      const record = records[index];
      const searchable = Object.values(record).join(" ").toLocaleLowerCase();
      card.hidden = query.length > 0 && !searchable.includes(query);
    });
  });
}
