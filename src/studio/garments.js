import { BACK_PRINT_PRICE as CATALOG_BACK_PRICE, PRODUCTS } from "../catalog.js";

/*
  The real garment photos (cut out from black backgrounds, see tools/cutout.mjs).
  Each view's "print" box is where designs can go, in % of the photo:
    x / y = top-left corner, w / h = size, cm = real print size in centimetres.
  Side views have no print area.
  over = parts that hang on top of a print, like drawstrings (made by tools/overlays.mjs).
*/
export const VIEWS = ["front", "left", "back", "right"]; // turntable order
export const VIEW_LABEL = { front: "Front", left: "Left", back: "Back", right: "Right" };

export const GARMENTS = {
  tshirt: {
    name: "T-Shirt",
    tagline: "Heavyweight cotton tee",
    price: PRODUCTS.tshirt.price, // prices come from the site catalog (also used to check orders)
    ratio: 410 / 450,
    inkBoost: 1.25, // how much the fabric shading brightens/darkens prints
    views: {
      front: { src: "/garments/tshirt-front.png", print: { x: 31, y: 19, w: 38, h: 44, cm: [30, 40] } },
      back: { src: "/garments/tshirt-back.png", print: { x: 30, y: 15, w: 40, h: 48, cm: [32, 44] } },
      left: { src: "/garments/tshirt-left.png" },
      right: { src: "/garments/tshirt-right.png" },
    },
  },
  hoodie: {
    name: "Hoodie",
    tagline: "Brushed fleece hoodie",
    price: PRODUCTS.hoodie.price,
    ratio: 410 / 480,
    inkBoost: 1.55,
    views: {
      front: { src: "/garments/hoodie-front.png", over: "/garments/hoodie-front-over.png", print: { x: 32, y: 27, w: 36, h: 24, cm: [28, 20] } },
      back: { src: "/garments/hoodie-back.png", print: { x: 27, y: 29, w: 46, h: 42, cm: [36, 38] } },
      left: { src: "/garments/hoodie-left.png" },
      right: { src: "/garments/hoodie-right.png" },
    },
  },
};

export const BACK_PRINT_PRICE = CATALOG_BACK_PRICE;
export const priceOf = d => GARMENTS[d.product].price + (d.layers.back.length ? BACK_PRINT_PRICE : 0);
