```markdown
Báo cáo Phân tích Nguyên nhân Cạn Quota (110k Reads) trong 3 tiếng:

Sau khi rà soát toàn bộ mã nguồn `VibeSandbox` và `Core`, nguyên nhân KHÔNG đến từ việc tải dữ liệu nặng một lần, mà đến từ các **VÒNG LẶP RENDER & FIREBASE LISTENER (Infinite Read Loop)** ngầm.

Dưới đây là 3 nguyên nhân chính tạo ra vòng lặp đốt Reads:

### 1. Vòng lặp `getDoc` do Object Reference Dependency (`App.tsx` & `VibeStudyRoom.tsx`)
- **Cơ chế lỗi:** 
  Trong `App.tsx`, có một listener theo dõi document User (`onSnapshot(doc(db, "users", user.uid))`). Mỗi khi có thay đổi nhỏ (như điểm số, streak), nó gọi `store.updateCurrentUser(..., true)`. Hàm này tạo ra một **object `user` hoàn toàn mới** trong bộ nhớ và bắn Event `user-cosmetics-updated`.
  `VibeStudyRoom.tsx` nghe sự kiện này, cập nhật lại state `user`. 
- **Hệ quả (Vòng lặp đốt reads):** 
  Bên trong `VibeStudyRoom`, có một `useEffect` phụ thuộc vào nguyên cái object `[deck, user]`. Khi object `user` thay đổi reference (dù `id` giữ nguyên), Effect này chạy lại lập tức. Khổ nỗi bên trong Effect này lại gọi hàm `VibeProgressSyncManager.pullProgressFromCloud` -> chứa lệnh **`getDoc()`** từ Firestore.
  Chưa kể timer đếm giờ có thể vô tình làm component cha re-render. Việc gọi `getDoc()` bị spam liên tục (có thể vài chục lần 1 phút).

### 2. Full Table Scans không chủ đích ở `CardStateManager.ts` (Lỗ hổng Migration)
- **Cơ chế lỗi:**
  Trong hàm `CardStateManager.hydrateStates`, khi người dùng vào phòng học, hệ thống gọi `fsGetDocs(qDeckStates)`.
  Nếu `lastSync === 0` (lần đầu load hoặc rớt cache), nó sẽ fallback quét (getDocs) toàn bộ collection cũ `cardsState` mà **KHÔNG CÓ limit()**.
- **Hệ quả:**
  Nếu người dùng có vài ngàn thẻ học cũ, 1 lần load Component đã tốn vài ngàn Reads. Nếu bị dính lỗi số (1) (Component re-render liên tục), vài ngàn Reads này bị nhân lên N lần, dễ dàng chạm mốc 100.00k Reads chỉ trong chớp mắt.

### 3. Vòng lặp Push/Pull Timestamp hụt ở `VibeSyncEngine.ts`
- **Cơ chế lỗi:**
  Trong `VibeSyncEngine`, khi enqueue thay đổi (VD: Sửa Deck), hệ thống gán `timestamp = Date.now()`. Hàm `processQueue` đẩy lên Firebase nhưng **LẠI QUÊN không cập nhật cái timestamp mới này vào Local IDB**.
- **Hệ quả:**
  Firebase cập nhật -> bắn `onSnapshot` về client. Client so sánh thấy `remoteTime (mới) > localTime (cũ)`, nên ghi đè Local IDB và bắn sự kiện `this.notify()` để re-render UI. Sự lỏng lẻo này tạo ra các luồng dữ liệu giả (phantom updates), làm các component React liên tục chớp nháy và kéo theo các hàm gọi `getDoc` ở những nơi khác chạy lại.

**Kế hoạch khắc phục (Chỉ thực hiện khi bạn ra lệnh sửa):**
1. **Triệt tiêu Object Dependency:** Đổi toàn bộ `[deck, user]` thành `[deck?.id, user?.id]` trong các `useEffect` để chặn re-render do tham chiếu bộ nhớ.
2. **Khóa Van `getDocs` vô hạn:** Thêm cơ chế cờ (Ref) hoặc Debounce vào `pullProgressFromCloud` và `hydrateStates`, đảm bảo chỉ được quét đúng 1 lần duy nhất mỗi phiên.
3. **Vá SyncEngine:** Ghi đè lại `local.lastUpdatedAt` bằng `item.timestamp` ngay khi queue xử lý xong để chặn hiện tượng dội ngược `onSnapshot`.
```
