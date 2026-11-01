# Card Catalog -- 13 card nâng cấp (đã triển khai)

> Tài liệu nguồn cho `packages/sim/src/content.ts` (`CARD_CATALOG`).
> Đây là bộ card thực tế đã cài vào prototype Phase 1, phân theo 5 nhóm.
> Pistol là vũ khí duy nhất; các card "projectile" giả lập shotgun/SMG.

## Phân loại (CardCategory)

```ts
type CardCategory =
  | "projectile" // thay đổi đạn / quỹ đạo / kiểu bắn
  | "combat"     // lựu đạn, sát thương tổng hợp
  | "defense"    // máu, giảm sát thương nhận vào
  | "movement"   // tốc độ chạy, nhảy, leo tường
  | "passive";   // hiệu ứng thụ động ngoài chiến đấu
```

## 1. Projectile -- Giả lập shotgun / SMG / đạn đặc biệt

| Card      | Accent   | Hiệu ứng                                                        |
| --------- | -------- | --------------------------------------------------------------- |
| `BLAST`   | `#ff8a2b`| Đạn nổ khi chạm, gây sát thương vùng. Đẩy luôn người bắn.        |
| `BOUNCE`  | `#35d8ff`| Đạn nảy thêm 2 lần trên bề mặt.                                  |
| `RAPID`   | `#ffd400`| Tốc độ bắn x1.7 (giả lập SMG).                                   |
| `BUCKSHOT`| `#c78bff`| +6 viên, nở rộng (giả lập shotgun), bắn chậm hơn.                 |
| `PIERCE`  | `#4de1ff`| Đạn xuyên qua 1 đối thủ.                                         |
| `MEGA`    | `#ff5a4d`| +4 sát thương mỗi viên.                                          |

## 2. Combat -- Lựu đạn

| Card    | Accent   | Hiệu ứng                                      |
| ------- | -------- | --------------------------------------------- |
| `FRAG`  | `#8be04e`| Hồi lựu đạn về 0.5s.                          |
| `NITRO` | `#ff9d3c`| +45 bán kính nổ, +15 sát thương lựu đạn.      |

## 3. Defense -- Sống sót

| Card    | Accent   | Hiệu ứng                              |
| ------- | -------- | ------------------------------------- |
| `VITAL` | `#8be04e`| +30 max HP, hồi ngay 30 máu.          |
| `PLATE` | `#9aa4b8`| -25% sát thương nhận vào.             |

## 4. Movement -- Di chuyển

| Card     | Accent   | Hiệu ứng                            |
| -------- | -------- | ----------------------------------- |
| `DASH`   | `#4da3ff`| +22% tốc độ di chuyển.              |
| `SPRING` | `#ff8a5b`| +12% nhảy, +25% leo tường.          |

## 5. Passive -- Thụ động

| Card      | Accent   | Hiệu ứng                        |
| --------- | -------- | ------------------------------- |
| `FORTUNE` | `#ffd400`| +25% coin kiếm được trong Gauntlet. |

## Schema dữ liệu

```ts
type CardSpec = {
  id: CardId;
  name: string;
  category: CardCategory;
  accent: string;
  description: string;
  lines: Array<{ tone: "pos" | "neg"; text: string }>;
  art: CardId; // dùng chung id để vẽ art
};
```

## Quy tắc thiết kế

1.  Card được cộng dồn theo danh sách `player.cards`; mỗi card tối đa 1 lần
    (không stackable trong Phase 1).
2.  Hiệu ứng đọc trực tiếp từ `player.cards.includes(...)` tại thời điểm
    bắn/nhận sát thương, không hard-code vào UI.
3.  `applyCard` chỉ nhận card chưa có trong tay; `VITAL` tăng `maxHealth`
    ngay khi nhận.
4.  Deck UI hiển thị toàn bộ `CARD_CATALOG`, tô sáng card đã chọn.
