export type MenuTier = {
  code: "NORMAL" | "PLUS" | "PRO" | "ULTRA";
  th: string; en: string; price: number; eggs: number; toppings: number; rice: number;
};

export const MENU_TIERS: MenuTier[] = [
  { code:"NORMAL", th:"นอร์มอล", en:"Normal", price:70, eggs:2, toppings:5, rice:250 },
  { code:"PLUS", th:"พลัส", en:"Plus", price:80, eggs:3, toppings:5, rice:250 },
  { code:"PRO", th:"โปร", en:"Pro", price:90, eggs:4, toppings:5, rice:250 },
  { code:"ULTRA", th:"อัลตร้า", en:"Ultra", price:100, eggs:5, toppings:5, rice:250 }
];

export type Topping = { code:string; category:"protein"|"veg"|"extra"; th:string; en:string; allergen?:string };

export const TOPPINGS: Topping[] = [
["TOP-001","protein","หมูสับ","Minced pork"],["TOP-002","protein","ไก่สับ","Minced chicken"],
["TOP-003","protein","กุ้งสด","Fresh shrimp","Shellfish"],["TOP-004","protein","ปลาหมึก","Squid","Seafood"],
["TOP-005","protein","ปูอัด","Crab stick","Fish/Gluten possible"],["TOP-006","protein","ไส้กรอกแดง","Red sausage"],
["TOP-007","protein","ฮอตดอก","Hot dog"],["TOP-008","protein","โบโลน่า","Bologna"],
["TOP-009","protein","ลูกชิ้นหมู","Pork meatball"],["TOP-010","protein","ลูกชิ้นไก่","Chicken meatball"],
["TOP-011","protein","แฮม","Ham"],["TOP-012","protein","เบคอน","Bacon"],["TOP-013","protein","กุนเชียง","Chinese sausage"],
["TOP-014","protein","แหนม","Fermented pork"],["TOP-015","protein","หมูยอ","Vietnamese pork sausage"],
["TOP-016","protein","ไก่ยอ","Vietnamese chicken sausage"],["TOP-017","protein","เต้าหู้ปลา","Fish tofu","Fish"],
["TOP-018","protein","ทูน่า","Tuna","Fish"],["TOP-019","protein","ไก่ฉีก","Shredded chicken"],["TOP-020","protein","หมูเด้ง","Seasoned bouncy pork"],
["TOP-021","veg","ชะอม","Cha-om / acacia shoots"],["TOP-022","veg","กะเพรา","Holy basil"],["TOP-023","veg","โหระพา","Thai sweet basil"],
["TOP-024","veg","ต้นหอม","Spring onion"],["TOP-025","veg","ผักชี","Coriander"],["TOP-026","veg","ขึ้นฉ่าย","Celery"],
["TOP-027","veg","หอมหัวใหญ่","Onion"],["TOP-028","veg","หอมแดง","Shallot"],["TOP-029","veg","กระเทียม","Garlic"],
["TOP-030","veg","พริกสด","Fresh chilli"],["TOP-031","veg","พริกไทยดำบดหยาบ","Coarse black pepper"],["TOP-032","veg","แครอต","Carrot"],
["TOP-033","veg","ข้าวโพดหวาน","Sweet corn"],["TOP-034","veg","มะเขือเทศ","Tomato"],["TOP-035","veg","เห็ดฟาง","Straw mushroom"],
["TOP-036","veg","เห็ดเข็มทอง","Enoki mushroom"],["TOP-037","veg","เห็ดนางรม","Oyster mushroom"],["TOP-038","veg","กะหล่ำปลี","Cabbage"],
["TOP-039","veg","คะน้า","Chinese kale"],["TOP-040","veg","ผักโขม","Spinach"],["TOP-041","veg","ถั่วฝักยาว","Long bean"],
["TOP-042","veg","ถั่วลันเตา","Green peas"],["TOP-043","veg","พริกหวาน","Bell pepper"],["TOP-044","veg","ใบมะกรูดซอย","Sliced kaffir lime leaf"],
["TOP-045","veg","ตะไคร้ซอย","Sliced lemongrass"],["TOP-046","extra","ชีสเชดดาร์","Cheddar cheese","Milk"],
["TOP-047","extra","มอสซาเรลลาชีส","Mozzarella cheese","Milk"],["TOP-048","extra","สาหร่าย","Seaweed"],
["TOP-049","extra","กระเทียมเจียว","Crispy fried garlic"],["TOP-050","extra","หอมเจียว","Crispy fried shallot"]
].map(([code,category,th,en,allergen]) => ({code,category,th,en,allergen})) as Topping[];
