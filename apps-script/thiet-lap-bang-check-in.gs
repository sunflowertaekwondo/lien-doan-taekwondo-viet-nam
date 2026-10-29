/**
 * Thiet lap MOT LAN cac bang Google Sheet "Lich check-in Dai hoi X" tren Drive (khong thuoc Code.gs; dan them vao Apps Script roi chay tay).
 *  - Bang CONG KHAI trong thu muc Web_VTF: cong thuc IMPORTRANGE doc truc tiep bang dang ky cua BTC, CHI giu cot an toan
 *    (gio, don vi, so the, Quyen, trang thai). Tu cap nhat khi bang goc doi, khong can trigger hay quyen them.
 *  - Bang DAY DU trong thu muc RIENG TU: ban doc nguyen bang (co CCCD, SDT, email, ten HLV) - chi chu tai khoan thay.
 * Luu y: IMPORTDATA khong dung duoc (Google tra #REF!); IMPORTRANGE chay vi tai khoan co quyen xem bang goc.
 * Can Code.gs de co ham dkFolder_. Bang goc: lay dong 3..200 cua sheet dau tien (TT, TIME, DON VI, ..., TRANG THAI).
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
  var fs = full.getSheets()[0]; fs.setName('Check-in 23.11');
  fs.getRange('A1:L300').clearContent();
  fs.getRange('A1').setFormula('=IMPORTRANGE("' + NGUON + '","A1:L200")');
  SpreadsheetApp.flush();
  console.log('Cong khai: ' + sh.getParent().getUrl() + ' | Day du (rieng tu, quyen=' + DriveApp.getFileById(full.getId()).getSharingAccess() + '): ' + full.getUrl());
}
