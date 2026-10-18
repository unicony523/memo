/**
 * =========================================================================
 * 구글 시트 CRUD Google Apps Script (Code.gs)
 * =========================================================================
 * 대상 시트: https://docs.google.com/spreadsheets/d/1MRImfv5_ZjayKM_iQlQckRHVSGX8nm0LB3g7ndn7ems/edit?usp=sharing
 * 
 * 대상 헤더 (총 7개 컬럼):
 * A: timestamp (고유 식별자 / ID)
 * B: datetime  (작성/수정 일시, 예: 2026-10-19 00:42:00)
 * C: category  (카테고리: 할 일, 아이디어, 기타 등)
 * D: content   (메모 내용)
 * E: color     (메모 색상: yellow, pink, green, blue 등)
 * F: state     (상태: todo, done, active, completed 등)
 * G: order     (정렬 순서 번호: 0, 1, 2...)
 *
 * 지원 기능 (CRUD):
 * 1. Read (조회): action = "read" (전체 조회, timestamp 단건 조회, category별 필터 조회)
 * 2. Create (생성): action = "create" (신규 메모 추가)
 * 3. Update (수정): action = "update" (timestamp 기준 특정 필드들 선택적/전체 수정)
 * 4. Delete (삭제): action = "delete" (timestamp 기준 행 삭제)
 * 5. Reorder (순서 변경): action = "reorder" (order 일괄 업데이트)
 * =========================================================================
 */

// 스프레드시트 ID (공유해주신 시트 ID)
const SPREADSHEET_ID = "1MRImfv5_ZjayKM_iQlQckRHVSGX8nm0LB3g7ndn7ems";
const SHEET_NAME = "Sheet1";

// 7개 표준 컬럼 정의
const HEADERS = ["timestamp", "datetime", "category", "content", "color", "state", "order"];

/**
 * 시트 객체 반환 및 헤더 자동 초기화
 */
function getTargetSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.getSheets()[0];
  }

  // 시트가 비어있을 경우 헤더 자동 생성
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  } else {
    const currentHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
    if (String(currentHeaders[0]).toLowerCase() !== "timestamp") {
      sheet.insertRowBefore(1);
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    }
  }

  return sheet;
}

/**
 * GET 요청 핸들러 (조회 및 테스트용)
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const action = params.action || "read";

    if (action === "read") {
      return createJsonResponse(handleRead(params));
    }

    return createJsonResponse({
      success: false,
      message: "지원하지 않는 GET 액션입니다. POST 요청을 이용해주세요."
    });
  } catch (error) {
    return createJsonResponse({
      success: false,
      error: error.toString()
    });
  }
}

/**
 * POST 요청 핸들러 (CRUD 전체 지원)
 */
function doPost(e) {
  try {
    let data = {};
    if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    const action = data.action;

    switch (action) {
      case "read":
        return createJsonResponse(handleRead(data));

      case "create":
        return createJsonResponse(handleCreate(data));

      case "update":
        return createJsonResponse(handleUpdate(data));

      case "delete":
        return createJsonResponse(handleDelete(data));

      case "reorder":
        return createJsonResponse(handleReorder(data));

      default:
        return createJsonResponse({
          success: false,
          message: "유효하지 않은 action입니다. (read, create, update, delete, reorder 가능)"
        });
    }
  } catch (error) {
    return createJsonResponse({
      success: false,
      error: error.toString()
    });
  }
}

/**
 * 1. Read (조회)
 * @param {Object} filter - { timestamp?, category?, state? }
 */
function handleRead(filter) {
  filter = filter || {};
  const sheet = getTargetSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return {
      success: true,
      count: 0,
      data: []
    };
  }

  // 2행부터 전체 7개 열(A~G) 조회
  const range = sheet.getRange(2, 1, lastRow - 1, HEADERS.length);
  const values = range.getValues();

  let list = values.map((row, idx) => ({
    rowIndex: idx + 2,
    timestamp: String(row[0] || ""),
    datetime: String(row[1] || ""),
    category: String(row[2] || ""),
    content: String(row[3] || ""),
    color: String(row[4] || ""),
    state: String(row[5] || ""),
    order: row[6] !== "" && row[6] !== undefined ? Number(row[6]) : idx
  }));

  // 필터링 옵션
  if (filter.timestamp) {
    list = list.filter((item) => String(item.timestamp) === String(filter.timestamp));
  }
  if (filter.category && filter.category !== "전체") {
    list = list.filter((item) => item.category === filter.category);
  }
  if (filter.state) {
    list = list.filter((item) => item.state === filter.state);
  }

  // order 기준 오름차순 정렬
  list.sort((a, b) => a.order - b.order);

  return {
    success: true,
    count: list.length,
    data: list
  };
}

/**
 * 2. Create (생성)
 * @param {Object} data - { timestamp?, datetime?, category?, content, color?, state?, order? }
 */
function handleCreate(data) {
  const sheet = getTargetSheet();
  const lastRow = sheet.getLastRow();

  const now = new Date();
  const timestamp = data.timestamp ? String(data.timestamp) : String(now.getTime());
  const datetime = data.datetime ? String(data.datetime) : Utilities.formatDate(now, "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
  const category = data.category || "할 일";
  const content = data.content || "";
  const color = data.color || "yellow";
  const state = data.state || "active";
  const order = data.order !== undefined ? Number(data.order) : (lastRow <= 1 ? 0 : lastRow - 1);

  const newRow = [timestamp, datetime, category, content, color, state, order];
  sheet.appendRow(newRow);

  return {
    success: true,
    message: "성공적으로 추가되었습니다.",
    data: {
      timestamp: timestamp,
      datetime: datetime,
      category: category,
      content: content,
      color: color,
      state: state,
      order: order
    }
  };
}

/**
 * 3. Update (수정)
 * @param {Object} data - { timestamp, datetime?, category?, content?, color?, state?, order? }
 */
function handleUpdate(data) {
  const timestamp = data.timestamp;
  if (!timestamp) {
    return {
      success: false,
      message: "수정할 대상의 timestamp가 필수입니다."
    };
  }

  const sheet = getTargetSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return { success: false, message: "수정할 데이터가 존재하지 않습니다." };
  }

  const range = sheet.getRange(2, 1, lastRow - 1, HEADERS.length);
  const values = range.getValues();

  let targetIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(timestamp)) {
      targetIndex = i;
      break;
    }
  }

  if (targetIndex === -1) {
    return {
      success: false,
      message: "일치하는 timestamp 항목을 찾지 못했습니다: " + timestamp
    };
  }

  const rowNum = targetIndex + 2;
  const currentRow = values[targetIndex];

  // 전달된 값만 선택적으로 갱신 (미전달 시 기존 값 유지)
  const updatedDatetime = data.datetime !== undefined ? data.datetime : Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
  const updatedCategory = data.category !== undefined ? data.category : currentRow[2];
  const updatedContent = data.content !== undefined ? data.content : currentRow[3];
  const updatedColor = data.color !== undefined ? data.color : currentRow[4];
  const updatedState = data.state !== undefined ? data.state : currentRow[5];
  const updatedOrder = data.order !== undefined ? Number(data.order) : currentRow[6];

  const updatedRow = [
    String(timestamp),
    updatedDatetime,
    updatedCategory,
    updatedContent,
    updatedColor,
    updatedState,
    updatedOrder
  ];

  sheet.getRange(rowNum, 1, 1, HEADERS.length).setValues([updatedRow]);

  return {
    success: true,
    message: "성공적으로 수정되었습니다.",
    data: {
      timestamp: String(timestamp),
      datetime: updatedDatetime,
      category: updatedCategory,
      content: updatedContent,
      color: updatedColor,
      state: updatedState,
      order: updatedOrder
    }
  };
}

/**
 * 4. Delete (삭제)
 * @param {Object} data - { timestamp }
 */
function handleDelete(data) {
  const timestamp = data.timestamp;
  if (!timestamp) {
    return {
      success: false,
      message: "삭제할 대상의 timestamp가 필요합니다."
    };
  }

  const sheet = getTargetSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return { success: false, message: "삭제할 데이터가 존재하지 않습니다." };
  }

  const timestamps = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

  let foundRow = -1;
  for (let i = 0; i < timestamps.length; i++) {
    if (String(timestamps[i][0]) === String(timestamp)) {
      foundRow = i + 2;
      break;
    }
  }

  if (foundRow === -1) {
    return {
      success: false,
      message: "일치하는 timestamp를 찾을 수 없습니다: " + timestamp
    };
  }

  sheet.deleteRow(foundRow);

  return {
    success: true,
    message: "성공적으로 삭제되었습니다.",
    deletedTimestamp: String(timestamp)
  };
}

/**
 * 5. Reorder (드래그 앤 드롭 등 순서 일괄 갱신)
 * @param {Object} data - { items: [{ timestamp, order }, ...] }
 */
function handleReorder(data) {
  const items = data.items;
  if (!items || !Array.isArray(items)) {
    return { success: false, message: "items 배열이 필요합니다." };
  }

  const sheet = getTargetSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: true, count: 0 };

  const timestamps = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const orderMap = {};
  items.forEach((item) => {
    orderMap[String(item.timestamp)] = item.order;
  });

  const orderValues = [];
  for (let i = 0; i < timestamps.length; i++) {
    const ts = String(timestamps[i][0]);
    if (orderMap[ts] !== undefined) {
      orderValues.push([orderMap[ts]]);
    } else {
      orderValues.push([i]);
    }
  }

  // G열(order)에 일괄 기록
  sheet.getRange(2, 7, lastRow - 1, 1).setValues(orderValues);

  return {
    success: true,
    message: "순서가 성공적으로 일괄 갱신되었습니다.",
    updatedCount: items.length
  };
}

/**
 * JSON 응답 생성 헬퍼
 */
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
