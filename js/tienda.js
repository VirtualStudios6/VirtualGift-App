fetch("https://fnbr.co/api/shop")
  .then(res => res.json())
  .then(data => {
    const featured = document.getElementById("featured");
    const daily = document.getElementById("daily");

    data.data.featured.forEach(item => {
      featured.innerHTML += card(item);
    });

    data.data.daily.forEach(item => {
      daily.innerHTML += card(item);
    });
  })
  .catch(err => console.error(err));

function card(item){
  return `
    <div class="card">
      <img src="${item.images.icon}">
      <p>${item.name}</p>
      <p class="rarity">${item.rarity}</p>
      <p class="price">${item.price} V-Bucks</p>
    </div>
  `;
}
