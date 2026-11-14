import { BACK_PRINT_PRICE as CATALOG_BACK_PRICE, PRODUCTS } from "../catalog.js";

/*
  The real studio photos of the garments (the same shots as the home page), cut out
  from their black backdrop and upscaled 2x.
  Each view's "print" box is where designs can go, in % of the photo:
    x / y = top-left corner, w / h = size, cm = real print size in centimetres.
  Side views have no print area.
  over = parts that hang on top of a print, like the hoodie drawstrings.
*/
export const VIEWS = ["front", "left", "back", "right"]; // turntable order
export const VIEW_LABEL = { front: "Front", left: "Left", back: "Back", right: "Right" };

export const GARMENTS = {
  tshirt: {
    name: "T-Shirt",
    tagline: "Heavyweight cotton tee",
    price: PRODUCTS.tshirt.price, // prices come from the site catalog (also used to check orders)
    ratio: 410 / 450,
    // how the fabric shading falls on prints: light = (photo ^ inkGamma) * inkBoost,
    // tuned so the print keeps its colour on average and only the folds shade it
    inkBoost: 1.55,
    views: {
      front: { src: "/garments/tshirt-front.webp", print: { x: 32.2, y: 23, w: 38, h: 44, cm: [30, 40] } }, // centred on the chest (the body sits a touch right of the photo centre)
      back: { src: "/garments/tshirt-back.webp", print: { x: 31.2, y: 20, w: 40, h: 48, cm: [32, 44] } },
      left: { src: "/garments/tshirt-left.webp" },
      right: { src: "/garments/tshirt-right.webp" },
    },
  },
  hoodie: {
    name: "Hoodie",
    tagline: "Brushed fleece hoodie",
    price: PRODUCTS.hoodie.price,
    ratio: 410 / 480,
    inkBoost: 2.85, // black fabric: a softer curve, lifted, so prints stay bright
    inkGamma: 0.5,
    views: {
      front: { src: "/garments/hoodie-front.webp", over: "/garments/hoodie-front-over.webp", print: { x: 32.5, y: 28, w: 36, h: 24, cm: [28, 20] } }, // above the pocket
      back: { src: "/garments/hoodie-back.webp", print: { x: 27.5, y: 29, w: 46, h: 42, cm: [36, 38] } },
      left: { src: "/garments/hoodie-left.webp" },
      right: { src: "/garments/hoodie-right.webp" },
    },
  },
};

export const BACK_PRINT_PRICE = CATALOG_BACK_PRICE;
export const priceOf = d => GARMENTS[d.product].price + (d.layers.back.length ? BACK_PRINT_PRICE : 0);
