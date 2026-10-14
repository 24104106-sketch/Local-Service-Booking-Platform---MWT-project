/**
 * Centralized Service Image & Gallery Asset Registry
 * Provides unique, realistic high-quality photo assets and 5-item galleries for every service.
 */

export const SERVICE_IMAGE_MAP = {
  acRepair: {
    folder: "ac-repair",
    main: "/images/services/ac-repair/main.jpg",
    fallbackMain: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "/images/services/ac-repair/thumb-1.jpg",
      "/images/services/ac-repair/thumb-2.jpg",
      "/images/services/ac-repair/thumb-3.jpg",
      "/images/services/ac-repair/thumb-4.jpg",
    ],
    fallbackGallery: [
      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1581092162384-8987c1d64718?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=600&q=80",
    ],
    alt: "Technician repairing split air conditioner unit",
    defaultTag: "AC Repair & Service",
  },
  plumbing: {
    folder: "plumbing",
    main: "/images/services/plumbing/main.jpg",
    fallbackMain: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "/images/services/plumbing/thumb-1.jpg",
      "/images/services/plumbing/thumb-2.jpg",
      "/images/services/plumbing/thumb-3.jpg",
      "/images/services/plumbing/thumb-4.jpg",
    ],
    fallbackGallery: [
      "https://images.unsplash.com/photo-1542013936693-884638332954?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1632759145351-1d592919f522?auto=format&fit=crop&w=600&q=80",
    ],
    alt: "Plumber fixing water pipes and leak repair",
    defaultTag: "Plumbing Service",
  },
  electrical: {
    folder: "electrical",
    main: "/images/services/electrical/main.jpg",
    fallbackMain: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "/images/services/electrical/thumb-1.jpg",
      "/images/services/electrical/thumb-2.jpg",
      "/images/services/electrical/thumb-3.jpg",
      "/images/services/electrical/thumb-4.jpg",
    ],
    fallbackGallery: [
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1581092162384-8987c1d64718?auto=format&fit=crop&w=600&q=80",
    ],
    alt: "Electrician inspecting distribution board and wiring",
    defaultTag: "Electrical Work",
  },
  cleaning: {
    folder: "cleaning",
    main: "/images/services/cleaning/main.jpg",
    fallbackMain: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "/images/services/cleaning/thumb-1.jpg",
      "/images/services/cleaning/thumb-2.jpg",
      "/images/services/cleaning/thumb-3.jpg",
      "/images/services/cleaning/thumb-4.jpg",
    ],
    fallbackGallery: [
      "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=600&q=80",
    ],
    alt: "Professional home deep cleaning team at work",
    defaultTag: "Home Cleaning",
  },
  pestControl: {
    folder: "pest-control",
    main: "/images/services/pest-control/main.jpg",
    fallbackMain: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "/images/services/pest-control/thumb-1.jpg",
      "/images/services/pest-control/thumb-2.jpg",
      "/images/services/pest-control/thumb-3.jpg",
      "/images/services/pest-control/thumb-4.jpg",
    ],
    fallbackGallery: [
      "https://images.unsplash.com/photo-1584744982491-665216d95f8b?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?auto=format&fit=crop&w=600&q=80",
    ],
    alt: "Pest control technician applying safe treatment",
    defaultTag: "Pest Control",
  },
  applianceRepair: {
    folder: "appliance-repair",
    main: "/images/services/appliance-repair/main.jpg",
    fallbackMain: "https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "/images/services/appliance-repair/thumb-1.jpg",
      "/images/services/appliance-repair/thumb-2.jpg",
      "/images/services/appliance-repair/thumb-3.jpg",
      "/images/services/appliance-repair/thumb-4.jpg",
    ],
    fallbackGallery: [
      "https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1585338107529-13afc5f02586?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=600&q=80",
    ],
    alt: "Appliance repair technician testing microwave and geyser",
    defaultTag: "Appliance Repair",
  },
  painting: {
    folder: "painting",
    main: "/images/services/painting/main.jpg",
    fallbackMain: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "/images/services/painting/thumb-1.jpg",
      "/images/services/painting/thumb-2.jpg",
      "/images/services/painting/thumb-3.jpg",
      "/images/services/painting/thumb-4.jpg",
    ],
    fallbackGallery: [
      "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1534349762230-e0cadf78f5da?auto=format&fit=crop&w=600&q=80",
    ],
    alt: "Painter applying interior wall emulsion paint",
    defaultTag: "Painting & Waterproofing",
  },
  carpentry: {
    folder: "carpentry",
    main: "/images/services/carpentry/main.jpg",
    fallbackMain: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "/images/services/carpentry/thumb-1.jpg",
      "/images/services/carpentry/thumb-2.jpg",
      "/images/services/carpentry/thumb-3.jpg",
      "/images/services/carpentry/thumb-4.jpg",
    ],
    fallbackGallery: [
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1538688525198-9b88f6f53126?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=600&q=80",
    ],
    alt: "Carpenter fixing wooden furniture and door locks",
    defaultTag: "Carpentry & Woodwork",
  },
  roService: {
    folder: "ro-service",
    main: "/images/services/ro-service/main.jpg",
    fallbackMain: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "/images/services/ro-service/thumb-1.jpg",
      "/images/services/ro-service/thumb-2.jpg",
      "/images/services/ro-service/thumb-3.jpg",
      "/images/services/ro-service/thumb-4.jpg",
    ],
    fallbackGallery: [
      "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=600&q=80",
    ],
    alt: "Technician replacing water purifier RO membrane and filter",
    defaultTag: "RO / Water Purifier",
  },
  washingMachine: {
    folder: "washing-machine",
    main: "/images/services/washing-machine/main.jpg",
    fallbackMain: "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "/images/services/washing-machine/thumb-1.jpg",
      "/images/services/washing-machine/thumb-2.jpg",
      "/images/services/washing-machine/thumb-3.jpg",
      "/images/services/washing-machine/thumb-4.jpg",
    ],
    fallbackGallery: [
      "https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=600&q=80",
    ],
    alt: "Technician servicing washing machine drum and motor",
    defaultTag: "Washing Machine Repair",
  },
  refrigerator: {
    folder: "refrigerator",
    main: "/images/services/refrigerator/main.jpg",
    fallbackMain: "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "/images/services/refrigerator/thumb-1.jpg",
      "/images/services/refrigerator/thumb-2.jpg",
      "/images/services/refrigerator/thumb-3.jpg",
      "/images/services/refrigerator/thumb-4.jpg",
    ],
    fallbackGallery: [
      "https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1581092162384-8987c1d64718?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=600&q=80",
    ],
    alt: "Cooling technician inspecting refrigerator compressor and gas",
    defaultTag: "Refrigerator Repair",
  },
  cctv: {
    folder: "cctv",
    main: "/images/services/cctv/main.jpg",
    fallbackMain: "https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "/images/services/cctv/thumb-1.jpg",
      "/images/services/cctv/thumb-2.jpg",
      "/images/services/cctv/thumb-3.jpg",
      "/images/services/cctv/thumb-4.jpg",
    ],
    fallbackGallery: [
      "https://images.unsplash.com/photo-1580894732444-8ecded7900cd?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80",
    ],
    alt: "Security engineer installing CCTV dome camera",
    defaultTag: "CCTV & Security",
  },
  computerRepair: {
    folder: "computer-repair",
    main: "/images/services/computer-repair/main.jpg",
    fallbackMain: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=1200&q=80",
    gallery: [
      "/images/services/computer-repair/thumb-1.jpg",
      "/images/services/computer-repair/thumb-2.jpg",
      "/images/services/computer-repair/thumb-3.jpg",
      "/images/services/computer-repair/thumb-4.jpg",
    ],
    fallbackGallery: [
      "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=600&q=80",
    ],
    alt: "Hardware engineer testing laptop motherboard and chip",
    defaultTag: "Laptop & PC Repair",
  },
};

/**
 * Resolves the appropriate service image bundle for a given service object or name.
 */
export function getServiceImages(serviceOrName, categoryFallback = "") {
  let name = "";
  let category = "";

  if (typeof serviceOrName === "string") {
    name = serviceOrName.toLowerCase();
    category = (categoryFallback || "").toLowerCase();
  } else if (serviceOrName && typeof serviceOrName === "object") {
    name = (serviceOrName.name || serviceOrName.service || "").toLowerCase();
    category = (serviceOrName.category || categoryFallback || "").toLowerCase();
  }

  // Exact & Semantic keyword matches
  if (name.includes("ac") || name.includes("air condition") || name.includes("cooling") || name.includes("duct")) {
    return SERVICE_IMAGE_MAP.acRepair;
  }
  if (name.includes("plumb") || name.includes("pipe") || name.includes("tap") || name.includes("drain") || category.includes("plumb")) {
    return SERVICE_IMAGE_MAP.plumbing;
  }
  if (name.includes("electr") || name.includes("wiring") || name.includes("switch") || name.includes("mcb") || category.includes("electr")) {
    return SERVICE_IMAGE_MAP.electrical;
  }
  if (name.includes("clean") || name.includes("sanitize") || name.includes("sofa") || name.includes("deep") || category.includes("clean")) {
    return SERVICE_IMAGE_MAP.cleaning;
  }
  if (name.includes("pest") || name.includes("termite") || name.includes("cockroach") || name.includes("bug")) {
    return SERVICE_IMAGE_MAP.pestControl;
  }
  if (name.includes("wash") || name.includes("laundry") || name.includes("drum")) {
    return SERVICE_IMAGE_MAP.washingMachine;
  }
  if (name.includes("fridge") || name.includes("refrigerat") || name.includes("freezer")) {
    return SERVICE_IMAGE_MAP.refrigerator;
  }
  if (name.includes("ro") || name.includes("purifier") || name.includes("water filter") || name.includes("tds")) {
    return SERVICE_IMAGE_MAP.roService;
  }
  if (name.includes("cctv") || name.includes("camera") || name.includes("surveillance") || name.includes("security")) {
    return SERVICE_IMAGE_MAP.cctv;
  }
  if (name.includes("laptop") || name.includes("computer") || name.includes("pc") || name.includes("macbook")) {
    return SERVICE_IMAGE_MAP.computerRepair;
  }
  if (name.includes("paint") || name.includes("wall") || name.includes("waterproof")) {
    return SERVICE_IMAGE_MAP.painting;
  }
  if (name.includes("carpent") || name.includes("wood") || name.includes("furniture") || category.includes("carpent")) {
    return SERVICE_IMAGE_MAP.carpentry;
  }
  if (name.includes("appliance") || name.includes("microwave") || name.includes("geyser") || category.includes("appliance")) {
    return SERVICE_IMAGE_MAP.applianceRepair;
  }

  // Category fallback
  if (category.includes("home care")) return SERVICE_IMAGE_MAP.pestControl;
  if (category.includes("appliances")) return SERVICE_IMAGE_MAP.applianceRepair;

  // Default fallback
  return SERVICE_IMAGE_MAP.acRepair;
}

/**
 * Returns the primary cover image URL for a service with fallback
 */
export function getServiceCoverImage(serviceOrName, categoryFallback = "") {
  const item = getServiceImages(serviceOrName, categoryFallback);
  return item.main || item.fallbackMain;
}
