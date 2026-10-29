/**
 * Thiet lap cac bang Google Sheet "Lich check-in Dai hoi X" tren Drive (khong thuoc Code.gs; dan them vao Apps Script roi chay tay, chay lai bao nhieu lan cung duoc).
 *  - Bang CONG KHAI trong thu muc Web_VTF: cong thuc IMPORTRANGE doc truc tiep bang dang ky cua BTC, CHI giu cot an toan
 *    (gio, don vi, so the, Quyen, trang thai). Tu cap nhat khi bang goc doi, khong can trigger hay quyen them.
 *  - Bang DAY DU trong thu muc RIENG TU: ban doc nguyen bang (co CCCD, SDT, email, ten HLV), dinh dang giong bang goc - chi chu tai khoan thay.
 *  - Loi tat (shortcut) toi bang day du dat ngay trong Web_VTF de chu tai khoan mo thang; nguoi khac co lien ket thu muc cung KHONG mo duoc bang
 *    (loi tat khong cap them quyen). KHONG BAO GIO dat ban sao day du o Web_VTF vi thu muc nay cong khai.
 * Luu y: IMPORTDATA khong dung duoc (Google tra #REF!); IMPORTRANGE chay vi tai khoan co quyen xem bang goc.
 * Can Code.gs de co ham dkFolder_, webFolder_. Bang goc: lay sheet dau tien (TT, TIME, DON VI, ..., TRANG THAI).
 */
function taoBangCheckIn() {
  var NGUON = 'https://docs.google.com/spreadsheets/d/1il-aEu2-id8FnGEbMgHwt8IImpnZl94-RRgR6trbVBk/edit';
  var CONG_KHAI_ID = '1n6LpLIBiJqdsl9-cFr29L7DG8N8sf7vWrT6LKikAE4w'; // VTF - Lich check-in Dai hoi X (cong khai, tu cap nhat)
  var sh = SpreadsheetApp.openById(CONG_KHAI_ID).getSheets()[0];
  sh.getRange('A4:H300').clearContent();
  sh.getRange('A3:H3').setValues([['TT', 'Giờ', 'Đơn vị', 'Thẻ quan chức và HLV', 'Thẻ VĐV', 'Có thi Quyền', 'Trạng thái check-in', 'Khung giờ']]);
  sh.getRange('A4').setFormula('=LET(d,IMPORTRANGE("' + NGUON + '","A3:L200"),r,FILTER(d,ISNUMBER(INDEX(d,0,1))),' +
    'HSTACK(INDEX(r,0,1),ARRAYFORMULA(TEXT(INDEX(r,0,2),"h:mm")),INDEX(r,0,3),INDEX(r,0,7),INDEX(r,0,8),INDEX(r,0,9),' +
    'ARRAYFORMULA(IF(INDEX(r,0,3)="","",IF(INDEX(r,0,11)="PENDING","Chờ check-in",INDEX(r,0,11)))),' +
    'ARRAYFORMULA(IF(INDEX(r,0,3)="","Còn trống","Đã đăng ký"))))');
  sh.setName('Lich check-in');
  sh.getRange('A1').setFontWeight('bold').setFontSize(13);
  sh.getRange('A2').setFontStyle('italic');
  sh.getRange('A3:H3').setFontWeight('bold').setBackground('#0B1F4D').setFontColor('#FFFFFF');
  sh.setFrozenRows(3);
  [50, 70, 190, 150, 90, 110, 140, 110].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });

  var TEN = 'VTF - Check-in Đại hội X (đầy đủ, RIÊNG TƯ)', dir = dkFolder_(), it = dir.getFilesByName(TEN), full;
  if (it.hasNext()) full = SpreadsheetApp.openById(it.next().getId());
  else { full = SpreadsheetApp.create(TEN); DriveApp.getFileById(full.getId()).moveTo(dir); }
  taoBangDayDu_(full, NGUON);
  taoLoiTat_(full.getId());
  SpreadsheetApp.flush();
  console.log('Cong khai: ' + sh.getParent().getUrl() + ' | Day du (rieng tu, quyen=' + DriveApp.getFileById(full.getId()).getSharingAccess() + '): ' + full.getUrl());
}

/** Bang day du: tieu de + dong 2 (tieu de cot) + du lieu doc thang tu bang goc (IMPORTRANGE tu o A2), dinh dang gan giong bang goc. */
function taoBangDayDu_(full, NGUON) {
  var sh = full.getSheets()[0];
  sh.setName('Check-in 23.11');
  sh.getRange('A1:L300').breakApart().clearContent().clearFormat();
  sh.getRange('A2').setFormula('=IMPORTRANGE("' + NGUON + '","A2:L200")');
  var t = sh.getRange('A1:L1'); t.merge();
  sh.getRange('A1').setValue('ĐẠI HỘI THỂ THAO TOÀN QUỐC 2026 - THÔNG TIN CHECK-IN VÀ KIỂM TRA SCHEMA THEO ĐƠN VỊ (RIÊNG TƯ - tự cập nhật từ bảng của Ban Tổ chức)');
  t.setBackground('#F9CB9C').setFontWeight('bold').setFontSize(13).setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  sh.setRowHeight(1, 52);
  sh.getRange('A2:L2').setBackground('#7B8FB0').setFontColor('#FFFFFF').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  sh.setRowHeight(2, 62);
  var body = sh.getRange('A3:L60');
  body.setVerticalAlignment('middle').setBorder(true, true, true, true, true, true, '#BFBFBF', SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange('A3:B60').setHorizontalAlignment('center');
  sh.getRange('C3:C60').setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange('D3:I60').setHorizontalAlignment('center');
  sh.getRange('K3:K60').setHorizontalAlignment('center').setFontWeight('bold').setFontColor('#B91C14');
  sh.getRange('J3:J60').setWrap(true);
  sh.getRange('L3:L60').setWrap(true);
  [44, 64, 170, 190, 130, 120, 110, 90, 120, 300, 100, 170].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.setFrozenRows(2);
}

/** Loi tat toi bang day du ngay trong Web_VTF (khong tao ban sao, khong lo du lieu). Chay lai khong tao trung. */
function taoLoiTat_(fullId) {
  var TEN = 'VTF - Check-in Đại hội X (ĐẦY ĐỦ - riêng tư, chỉ chủ tài khoản mở được)', web = webFolder_(), it = web.getFilesByName(TEN);
  if (it.hasNext()) return;
  web.createShortcut(fullId).setName(TEN);
}
