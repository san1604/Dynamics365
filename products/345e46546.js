var SB1Common = SB1Common || {};

// ─────────────────────────────────────────────────────────────────────────────
//  SB1Common.saveQuoteDetails
//
//  Sends the full quote details payload to the sb1_saveandsyncquote Custom API.
//
//  Request parameters:
//    sb1_quotepayload : JSON string of the full payload
//    sb1_quotetype    : null (reserved for future use)
//
//  Response parameter:
//    sb1_response : JSON string containing the API result
//
//  @param {object} payload - All form field values keyed by logical field name.
//  @returns {Promise<object>} Parsed sb1_response object.
// ─────────────────────────────────────────────────────────────────────────────

SB1Common.saveQuoteDetails = async function (payload) {
    if (!payload || typeof payload !== 'object') {
        throw new Error('[SB1Common] saveQuoteDetails: payload must be a non-null object.');
    }

    // ── Log form type with a human-readable label ─────────────────────────────
    var formTypeLabels = { 1: 'Create', 2: 'Update', 3: 'Read Only', 4: 'Disabled', 6: 'Bulk Edit' };
    var formTypeLabel  = formTypeLabels[payload.form_type] || 'Unknown';
    console.log('[SB1Common] saveQuoteDetails → formType:', payload.form_type, '(' + formTypeLabel + ')');
    console.log('[SB1Common] saveQuoteDetails → payload:', JSON.stringify(payload, null, 2));

    // ── Call the Custom API ───────────────────────────────────────────────────
    var response;
    try {
        response = await fetch('/api/data/v9.1/sb1_saveandsyncquote', {
            method: 'POST',
            headers: {
                'Content-Type'    : 'application/json',
                'Accept'          : 'application/json',
                'OData-MaxVersion': '4.0',
                'OData-Version'   : '4.0'
            },
            body: JSON.stringify({
                sb1_quotepayload : JSON.stringify(payload),
                sb1_quotetype    : ""
            })
        });
    } catch (fetchErr) {
        throw new Error('[SB1Common] saveQuoteDetails: fetch failed – ' + (fetchErr.message || fetchErr));
    }

    if (!response.ok) {
        var errText;
        try { errText = await response.text(); } catch (_) { errText = '(no body)'; }
        throw new Error('[SB1Common] saveQuoteDetails: API returned HTTP ' + response.status + ' – ' + errText);
    }

    // ── Parse outer envelope ──────────────────────────────────────────────────
    var envelope;
    try {
        envelope = await response.json();
    } catch (parseErr) {
        throw new Error('[SB1Common] saveQuoteDetails: failed to parse response JSON.');
    }

    if (!envelope || envelope.sb1_response === undefined) {
        throw new Error('[SB1Common] saveQuoteDetails: sb1_response is missing from the response.');
    }

    // ── Parse inner response string ───────────────────────────────────────────
    var parsed;
    try {
        parsed = typeof envelope.sb1_response === 'string'
            ? JSON.parse(envelope.sb1_response)
            : envelope.sb1_response;
    } catch (jsonErr) {
        // Return raw string if it is not valid JSON
        parsed = envelope.sb1_response;
    }

    console.log('[SB1Common] saveQuoteDetails → response received:', parsed);

    // ── Handle response properly ─────────────────────────────────────
if (!parsed || typeof parsed !== 'object') {
    return {
        success: false,
        message: 'Invalid response from server.'
    };
}

// ❌ ERROR CASE
if (!parsed.success) {
    console.warn('[SB1Common] saveQuoteDetails → Error:', parsed.message);

    return {
        success: false,
        message: parsed.message || 'Something went wrong.'
    };
}

// ✅ SUCCESS CASE
var createdId = parsed?.data?.CreatedQuoteId || null;

console.log('[SB1Common] saveQuoteDetails → Success. ID:', createdId);

return {
    success: true,
    message: parsed.message || 'Quote created successfully.',
    id: createdId
};
};


// ─────────────────────────────────────────────────────────────────────────────
//  SB1Common.triggerLatestVersionApi
//
//  Calls the sb1_triggerlatestversionapi Custom API with the given quoteId
//  and returns the parsed Data array from the response.
//
//  @param {string|number} quoteId  sb1_quoteid field value (NOT the record GUID)
//  @returns {Promise<Array>}
// ─────────────────────────────────────────────────────────────────────────────
SB1Common.triggerLatestVersionApi = async function (quoteId) {
    if (quoteId === null || quoteId === undefined || quoteId === '') {
        throw new Error('[SB1Common] triggerLatestVersionApi: quoteId is required.');
    }

    console.log('[SB1Common] triggerLatestVersionApi → sb1_quoteid:', String(quoteId));

    var response;
    try {
        response = await fetch('/api/data/v9.1/sb1_triggerlatestversionapi', {
            method: 'POST',
            headers: {
                'Content-Type'    : 'application/json',
                'Accept'          : 'application/json',
                'OData-MaxVersion': '4.0',
                'OData-Version'   : '4.0'
            },
            body: JSON.stringify({
                sb1_quoteid: String(quoteId)
            })
        });
    } catch (execErr) {
        throw new Error('[SB1Common] triggerLatestVersionApi: fetch failed – ' + (execErr.message || execErr));
    }

    if (!response.ok) {
        throw new Error('[SB1Common] triggerLatestVersionApi: API returned a non-OK HTTP status.');
    }

    var result;
    try {
        result = await response.json();
    } catch (parseErr) {
        throw new Error('[SB1Common] triggerLatestVersionApi: failed to parse response JSON.');
    }

    var rawJson = result && result.sb1_latestversionresponse;
    if (!rawJson) {
        throw new Error('[SB1Common] triggerLatestVersionApi: sb1_latestversionresponse is missing from the response.');
    }

    var parsed;
    try {
        parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
    } catch (jsonErr) {
        throw new Error('[SB1Common] triggerLatestVersionApi: failed to parse sb1_latestversionresponse JSON.');
    }

    if (!parsed || !parsed.Result) {
        throw new Error('[SB1Common] triggerLatestVersionApi: unexpected response structure.');
    }

    if (parsed.Result.Status !== 'Success' || !Array.isArray(parsed.Result.Data)) {
        throw new Error('[SB1Common] triggerLatestVersionApi: API returned failure – ' + (parsed.Result.Message || 'Unknown error'));
    }

    console.log('[SB1Common] triggerLatestVersionApi → received', parsed.Result.Data.length, 'items.');

    return parsed.Result.Data;
};


// ─────────────────────────────────────────────────────────────────────────────
//  SB1Common.callQuoteAPIforCopyQuote
//
//  Called from the CRM form's OnLoad event when a quote is being copied
//  (sb1_quotetype === 2). Fetches dropdown lists for the effective date and
//  posts them to the web resource iframe via postMessage.
//
//  @param {object} executionContext - Xrm execution context.
// ─────────────────────────────────────────────────────────────────────────────
SB1Common.callQuoteAPIforCopyQuote = async function (executionContext) {
    var formContext = executionContext.getFormContext();

    if (formContext.getAttribute('sb1_quotetype')?.getValue() !== 2) return;

    var effDate = formContext.getAttribute('effectivefrom')?.getValue();
    if (!effDate) return;

    var response;
    try {
        response = await fetch('/api/data/v9.1/sb1_getquotedetailsfromdate', {
            method: 'POST',
            headers: {
                'Content-Type'    : 'application/json',
                'Accept'          : 'application/json',
                'OData-MaxVersion': '4.0',
                'OData-Version'   : '4.0'
            },
            body: JSON.stringify({
                sb1_effdate: effDate.toISOString()
            })
        });
    } catch (execErr) {
        throw new Error('[SB1Common] callQuoteAPIforCopyQuote: fetch failed – ' + (execErr.message || execErr));
    }

    if (!response.ok) {
        Xrm.Navigation.openAlertDialog({ text: 'API Error: ' + await response.text() });
        return;
    }

    var data;
    try {
        data = await response.json();
    } catch (parseErr) {
        throw new Error('[SB1Common] callQuoteAPIforCopyQuote: failed to parse response JSON.');
    }

    var details = JSON.parse(data.sb1_getdetails);
    var lists   = details.Result.Data;

    var iframe = formContext.getControl('WebResource_quotefields');
    if (!iframe) return;

    iframe.getContentWindow().then(function (win) {
        win.postMessage({
            StateList        : lists.StateList,
            RegionList       : lists.RegionList,
            FundingList      : lists.FundingArrangementList,
            LOBList          : lists.LineOfBusinessList,
            MarketSegmentList: lists.MarketSegmentList
        }, '*');
    });
};


// ─────────────────────────────────────────────────────────────────────────────
//  SB1Common.populateQuoteDropdownsFromDate
//
//  Fetches quote configuration lists from the sb1_getquotedetailsfromdate API
//  using the supplied effective date, then populates the four choice fields
//  (Line of Business, Market Segment, State, Region) in the web resource
//  iframe and conditionally populates + shows/hides the Funding Arrangement
//  field based on the current Market Segment selection.
//
//  @param {string|Date} effDate  - The effective-from date (Date object or
//                                   ISO string / yyyy-mm-dd string).
//  @param {object}      formCtx  - Optional object with helper callbacks:
//    {
//      getMarketSegmentValue : () => string,   // returns current market segment
//      onListsLoaded         : (lists) => void // called after dropdowns are set
//    }
//
//  @returns {Promise<object>}  The raw Data object returned by the API:
//    { StateList, RegionList, FundingArrangementList,
//      LineOfBusinessList, MarketSegmentList }
// ─────────────────────────────────────────────────────────────────────────────
SB1Common.populateQuoteDropdownsFromDate = async function (effDate, formCtx) {
    if (!effDate) {
        throw new Error('[SB1Common] populateQuoteDropdownsFromDate: effDate is required.');
    }

    // ── 1. Normalise the date to an ISO string ────────────────────────────────
    var isoDate;
    if (effDate instanceof Date) {
        isoDate = effDate.toISOString();
    } else if (typeof effDate === 'string') {
        isoDate = effDate.length === 10
            ? new Date(effDate + 'T00:00:00').toISOString()
            : effDate;
    } else {
        throw new Error('[SB1Common] populateQuoteDropdownsFromDate: effDate must be a Date or string.');
    }

    console.log('[SB1Common] populateQuoteDropdownsFromDate → sb1_effdate:', isoDate);

    // ── 2. Call the API ───────────────────────────────────────────────────────
    var response;
    try {
        response = await fetch('/api/data/v9.1/sb1_getquotedetailsfromdate', {
            method: 'POST',
            headers: {
                'Content-Type'    : 'application/json',
                'Accept'          : 'application/json',
                'OData-MaxVersion': '4.0',
                'OData-Version'   : '4.0'
            },
            body: JSON.stringify({ sb1_effdate: isoDate })
        });
    } catch (fetchErr) {
        throw new Error('[SB1Common] populateQuoteDropdownsFromDate: fetch failed – ' + (fetchErr.message || fetchErr));
    }

    if (!response.ok) {
        throw new Error('[SB1Common] populateQuoteDropdownsFromDate: API returned HTTP ' + response.status);
    }

    // ── 3. Parse the outer envelope ───────────────────────────────────────────
    var envelope;
    try {
        envelope = await response.json();
    } catch (parseErr) {
        throw new Error('[SB1Common] populateQuoteDropdownsFromDate: failed to parse response JSON.');
    }

    if (!envelope.sb1_getdetails) {
        throw new Error('[SB1Common] populateQuoteDropdownsFromDate: sb1_getdetails missing from response.');
    }

    // ── 4. Parse the inner payload ────────────────────────────────────────────
    var payload;
    try {
        payload = typeof envelope.sb1_getdetails === 'string'
            ? JSON.parse(envelope.sb1_getdetails)
            : envelope.sb1_getdetails;
    } catch (jsonErr) {
        throw new Error('[SB1Common] populateQuoteDropdownsFromDate: failed to parse sb1_getdetails JSON.');
    }

    if (!payload || !payload.Result) {
        throw new Error('[SB1Common] populateQuoteDropdownsFromDate: unexpected response structure.');
    }

    if (payload.Result.Status !== 'Success') {
        throw new Error('[SB1Common] populateQuoteDropdownsFromDate: API failure – ' + (payload.Result.Message || 'Unknown error'));
    }

    var lists = payload.Result.Data;
    console.log('[SB1Common] populateQuoteDropdownsFromDate → lists received:', Object.keys(lists));

    // ── 5. Helper: split a comma-separated list string into an array ──────────
    function splitList(raw) {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        return String(raw).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    }

    // ── 6. Helper: rebuild a <select> from an array of string values ──────────
    //        Preserves the previously selected value if it still exists.
    function fillSelect(selectId, items) {
        var sel = document.getElementById(selectId);
        if (!sel) {
            console.warn('[SB1Common] populateQuoteDropdownsFromDate: element not found –', selectId);
            return;
        }
        var current = sel.value;
        sel.innerHTML = '<option value="">Select…</option>';
        items.forEach(function (item) {
            var opt       = document.createElement('option');
            opt.value     = String(item);
            opt.textContent = String(item);
            sel.appendChild(opt);
        });
        if (current && items.indexOf(current) !== -1) {
            sel.value = current;
        }
    }

    // ── 7. Populate the four main choice fields ───────────────────────────────
    fillSelect('detailLob',    splitList(lists.LineOfBusinessList));
    fillSelect('detailMarket', splitList(lists.MarketSegmentList));
    fillSelect('detailState',  splitList(lists.StateList));
    fillSelect('detailRegion', splitList(lists.RegionList));

    // ── 8. Populate Funding Arrangement (always built; visibility toggled) ────
    var fundingItems = splitList(lists.FundingArrangementList);
    fillSelect('detailFunding', fundingItems);

    // ── 9. Show / hide Funding Arrangement based on Market Segment value ──────
    var currentMarket;
    if (formCtx && typeof formCtx.getMarketSegmentValue === 'function') {
        currentMarket = formCtx.getMarketSegmentValue();
    } else {
        var marketEl  = document.getElementById('detailMarket');
        currentMarket = marketEl ? marketEl.value : '';
    }

    var fundingRow = document.getElementById('fundingArrangementRow');
    if (fundingRow) {
        var isLargeGroup = String(currentMarket).toLowerCase() === 'large group';
        fundingRow.style.display = isLargeGroup ? '' : 'none';
        if (!isLargeGroup) {
            var fundingSel = document.getElementById('detailFunding');
            if (fundingSel) fundingSel.value = '';
        }
    }

    // ── 10. Notify caller if a callback was provided ──────────────────────────
    if (formCtx && typeof formCtx.onListsLoaded === 'function') {
        formCtx.onListsLoaded(lists);
    }

    return lists;
};


// ─────────────────────────────────────────────────────────────────────────────
//  SB1Common.syncNewQuote
//
//  Persists a quote's field data to the Dataverse table sb1_quotepoc via the
//  Web API. Performs a PATCH (update) when a record GUID is available in the
//  payload, or a POST (create) when no GUID is present.
//
//  Expected payload shape (all fields optional except those marked †):
//  {
//    sb1_quotepocid       : string | null,   // GUID — PATCH if present, POST if null
//    sb1_name             : string,          // † Name (primary name column)
//    sb1_quoteid          : string,          // Quote ID (text)
//    sb1_lineofbusiness   : string,
//    sb1_marketsegment    : string,
//    sb1_region           : string,
//    sb1_state            : string,
//    sb1_fundingarrangement : string,
//    sb1_effectivefrom    : string,          // yyyy-mm-dd or ISO
//    sb1_effectiveto      : string,          // yyyy-mm-dd or ISO
//    sb1_quotetype        : number | null,   // Choice integer
//    sb1_quotestatus      : number | null,   // Choice integer
//    sb1_quotestage       : number | null,   // Choice integer
//    sb1_customerid       : string | null,   // Account GUID
//    sb1_broker           : string | null,   // Broker GUID
//  }
//
//  @param {object} payload
//  @returns {Promise<{id: string, created: boolean}>}
// ─────────────────────────────────────────────────────────────────────────────
SB1Common.syncNewQuote = async function (payload) {
    if (!payload || typeof payload !== 'object') {
        throw new Error('[SB1Common] syncNewQuote: payload must be a non-null object.');
    }

    var TABLE_PLURAL = 'sb1_quotepocs';
    var API_BASE     = '/api/data/v9.2/';
    var body         = {};

    // ── Text fields ───────────────────────────────────────────────────────────
    var textFields = [
        'sb1_name', 'sb1_quoteid', 'sb1_lineofbusiness',
        'sb1_marketsegment', 'sb1_region', 'sb1_state', 'sb1_fundingarrangement'
    ];
    textFields.forEach(function (field) {
        var val = payload[field];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
            body[field] = String(val).trim();
        }
    });

    // ── Date fields ───────────────────────────────────────────────────────────
    ['sb1_effectivefrom', 'sb1_effectiveto'].forEach(function (field) {
        var val = payload[field];
        if (val) {
            body[field] = String(val).length === 10 ? val + 'T00:00:00Z' : val;
        }
    });

    // ── Choice (integer option-set) fields ────────────────────────────────────
    ['sb1_quotetype', 'sb1_quotestatus', 'sb1_quotestage'].forEach(function (field) {
        var val = payload[field];
        if (val !== undefined && val !== null && val !== '') {
            var intVal = parseInt(val, 10);
            if (!isNaN(intVal)) body[field] = intVal;
        }
    });

    // ── Lookup fields (@odata.bind) ───────────────────────────────────────────
    var lookupMap = {
        sb1_customerid: 'accounts',
        sb1_broker    : 'sb1_brokers'
    };
    Object.keys(lookupMap).forEach(function (field) {
        var guid = payload[field];
        if (guid && String(guid).trim() !== '') {
            body[field + '@odata.bind'] = '/' + lookupMap[field] + '(' + String(guid).trim() + ')';
        }
    });

    // ── Determine CREATE vs UPDATE ────────────────────────────────────────────
    var recordId   = payload.sb1_quotepocid
        ? String(payload.sb1_quotepocid).replace(/[{}]/g, '').trim()
        : null;
    var isUpdate   = !!recordId;
    var url        = API_BASE + TABLE_PLURAL + (isUpdate ? '(' + recordId + ')' : '');
    var httpMethod = isUpdate ? 'PATCH' : 'POST';

    console.log('[SB1Common] syncNewQuote →', httpMethod, url, body);

    var response;
    try {
        response = await fetch(url, {
            method: httpMethod,
            headers: {
                'Content-Type'    : 'application/json',
                'Accept'          : 'application/json',
                'OData-MaxVersion': '4.0',
                'OData-Version'   : '4.0',
                'Prefer'          : isUpdate ? 'return=minimal' : 'return=representation'
            },
            body: JSON.stringify(body)
        });
    } catch (fetchErr) {
        throw new Error('[SB1Common] syncNewQuote: fetch failed – ' + (fetchErr.message || fetchErr));
    }

    if (!response.ok) {
        var errText;
        try { errText = await response.text(); } catch (_) { errText = '(no body)'; }
        throw new Error('[SB1Common] syncNewQuote: API returned HTTP ' + response.status + ' – ' + errText);
    }

    var savedId = recordId;

    if (!isUpdate) {
        var created;
        try {
            created = await response.json();
        } catch (parseErr) {
            throw new Error('[SB1Common] syncNewQuote: failed to parse POST response JSON.');
        }
        savedId = created && created.sb1_quotepocid;
        if (!savedId) {
            var entityIdHeader = response.headers.get('OData-EntityId') || '';
            var match          = entityIdHeader.match(/\(([^)]+)\)/);
            savedId            = match ? match[1] : null;
        }
    }

    console.log('[SB1Common] syncNewQuote → saved, id:', savedId, ', created:', !isUpdate);

    return { id: savedId, created: !isUpdate };
};


// ─────────────────────────────────────────────────────────────────────────────
//  SB1Common.updateProductName
//
//  Sends a product-name update request to the sb1_updateproductnamesyncb1
//  Custom API and returns the parsed response.
//
//  @param {object} payload
//    {
//      FormInstanceID  : string,
//      FormName        : string,
//      FolderID        : string,
//      FolderVersionId : string
//    }
//
//  @returns {Promise<object>}
// ─────────────────────────────────────────────────────────────────────────────
SB1Common.updateProductName = async function (payload) {
    if (!payload || typeof payload !== 'object') {
        throw new Error('[SB1Common] updateProductName: payload must be a non-null object.');
    }
    if (!payload.FormInstanceID || !payload.FormName || !payload.FolderID || !payload.FolderVersionId) {
        throw new Error('[SB1Common] updateProductName: payload must include FormInstanceID, FormName, FolderID, and FolderVersionId.');
    }

    console.log('[SB1Common] updateProductName → payload:', JSON.stringify(payload));

    var response;
    try {
        response = await fetch('/api/data/v9.1/sb1_updateproductnamesyncb1', {
            method: 'POST',
            headers: {
                'Content-Type'    : 'application/json',
                'Accept'          : 'application/json',
                'OData-MaxVersion': '4.0',
                'OData-Version'   : '4.0'
            },
            body: JSON.stringify({
                sb1_reqpayload: JSON.stringify(payload)
            })
        });
    } catch (fetchErr) {
        throw new Error('[SB1Common] updateProductName: fetch failed – ' + (fetchErr.message || fetchErr));
    }

    if (!response.ok) {
        var errText;
        try { errText = await response.text(); } catch (_) { errText = '(no body)'; }
        throw new Error('[SB1Common] updateProductName: API returned HTTP ' + response.status + ' – ' + errText);
    }

    var result;
    try {
        result = await response.json();
    } catch (parseErr) {
        throw new Error('[SB1Common] updateProductName: failed to parse response JSON.');
    }

    if (!result || result.sb1_updateproductres === undefined) {
        throw new Error('[SB1Common] updateProductName: sb1_updateproductres is missing from the response.');
    }

    var parsed;
    try {
        parsed = typeof result.sb1_updateproductres === 'string'
            ? JSON.parse(result.sb1_updateproductres)
            : result.sb1_updateproductres;
    } catch (jsonErr) {
        parsed = result.sb1_updateproductres;
    }

   console.log('[SB1Common] updateProductName → response received.');

let status = parsed?.Result?.Status || parsed?.Status;
let message = parsed?.Result?.Message || parsed?.Message || 'Unknown response';

return {
    isSuccess: String(status).toLowerCase() === 'success',
    message: message,
    raw: parsed // optional, if you still want full response
};
};

// ─────────────────────────────────────────────────────────────────────────────
//  SB1Common.deleteProducts
//
//  Sends a comma-separated list of FormInstanceIDs to the
//  sb1_deleteproductssyncwithb1 Custom API and returns the parsed response.
//
//  @param {string} formInstanceIds  Comma-separated FormInstanceID values
//                                   e.g. "101,102,103"
//  @returns {Promise<{isSuccess: boolean, message: string, raw: object}>}
// ─────────────────────────────────────────────────────────────────────────────
SB1Common.deleteProducts = async function (formInstanceIds) {
    if (!formInstanceIds || typeof formInstanceIds !== 'string' || !formInstanceIds.trim()) {
        throw new Error('[SB1Common] deleteProducts: formInstanceIds must be a non-empty string.');
    }

    console.log('[SB1Common] deleteProducts → sb1_forminstanceid:', formInstanceIds);

    var response;
    try {
        response = await fetch('/api/data/v9.1/sb1_deleteproductssyncwithb1', {
            method: 'POST',
            headers: {
                'Content-Type'    : 'application/json',
                'Accept'          : 'application/json',
                'OData-MaxVersion': '4.0',
                'OData-Version'   : '4.0'
            },
            body: JSON.stringify({
                sb1_forminstanceid: formInstanceIds.trim()
            })
        });
    } catch (fetchErr) {
        throw new Error('[SB1Common] deleteProducts: fetch failed – ' + (fetchErr.message || fetchErr));
    }

    if (!response.ok) {
        var errText;
        try { errText = await response.text(); } catch (_) { errText = '(no body)'; }
        throw new Error('[SB1Common] deleteProducts: API returned HTTP ' + response.status + ' – ' + errText);
    }

    var result;
    try {
        result = await response.json();
    } catch (parseErr) {
        throw new Error('[SB1Common] deleteProducts: failed to parse response JSON.');
    }

    if (!result || result.sb1_response === undefined) {
        throw new Error('[SB1Common] deleteProducts: sb1_response is missing from the response.');
    }

    var parsed;
    try {
        parsed = typeof result.sb1_response === 'string'
            ? JSON.parse(result.sb1_response)
            : result.sb1_response;
    } catch (jsonErr) {
        parsed = result.sb1_response;
    }

    console.log('[SB1Common] deleteProducts → response received:', parsed);

// The plugin returns { Results: [ { FormInstanceID, Status, Response: { Errors, Result: { Status, Message } } } ] }
// Check if ALL deletions succeeded, or fall back to top-level Result shape
let isSuccess = false;
let message   = 'Unknown response';

if (parsed && Array.isArray(parsed.Results)) {
    // Per-ID results array from the plugin loop
    const failed = parsed.Results.filter(r => String(r.Status).toLowerCase() !== 'success');
    isSuccess = failed.length === 0;
    message   = isSuccess
        ? (parsed.Results[0]?.Response?.Result?.Message || 'Deleted successfully.')
        : failed.map(r => `ID ${r.FormInstanceID}: ${r.Message || 'Failed'}`).join('; ');

} else if (parsed && parsed.Result) {
    // Direct single Result shape: { Result: { Status, Message } }
    const status = parsed.Result.Status || parsed.Status;
    isSuccess    = String(status).toLowerCase() === 'success';
    message      = parsed.Result.Message || parsed.Message || 'Unknown response';
}

return {
    isSuccess : isSuccess,
    message   : message,
    raw       : parsed
};
};

SB1Common.getDocumentNames = async function () {
    console.log('[SB1Common] getDocumentNames → calling API');
    let response;
    try {
        response = await fetch('/api/data/v9.1/sb1_getdocumentnames', {
            method: 'POST',
            headers: {
                'Content-Type'    : 'application/json',
                'Accept'          : 'application/json',
                'OData-MaxVersion': '4.0',
                'OData-Version'   : '4.0'
            },
            body: JSON.stringify({})
        });
    } catch (fetchErr) {
        throw new Error('[SB1Common] getDocumentNames: fetch failed – ' + (fetchErr.message || fetchErr));
    }

    if (!response.ok) {
        let errText;
        try { errText = await response.text(); } catch (_) { errText = '(no body)'; }
        throw new Error('[SB1Common] getDocumentNames: HTTP ' + response.status + ' – ' + errText);
    }

    // ── Read as TEXT first so we can log the raw body before any parse attempt ──
    let rawText;
    try {
        rawText = await response.text();
    } catch (e) {
        throw new Error('[SB1Common] getDocumentNames: failed to read response body.');
    }
    console.log('[SB1Common] getDocumentNames → raw response text:', rawText);

    // ── Parse the outer OData envelope ──
    let result;
    try {
        result = JSON.parse(rawText);
    } catch (parseErr) {
        throw new Error('[SB1Common] getDocumentNames: outer JSON parse failed. Raw: ' + rawText.slice(0, 300));
    }

    console.log('[SB1Common] getDocumentNames → outer result:', result);

    // ── Extract sb1_docnames — it may be absent, a string, or already an object ──
    if (!result || result.sb1_docnames === undefined) {
        throw new Error('[SB1Common] getDocumentNames: sb1_docnames missing. Keys present: ' + Object.keys(result || {}).join(', '));
    }

    let envelope;
    if (typeof result.sb1_docnames === 'string') {
        try {
            envelope = JSON.parse(result.sb1_docnames);
        } catch (e) {
            throw new Error('[SB1Common] getDocumentNames: sb1_docnames inner parse failed. Value: ' + result.sb1_docnames.slice(0, 300));
        }
    } else {
        envelope = result.sb1_docnames;
    }

    console.log('[SB1Common] getDocumentNames → envelope:', envelope);

    // ── Drill into Result.Data ──
    // Shape: { Errors:[], Result:{ Status:"Success", Data:[...] } }
    if (envelope?.Result?.Data && Array.isArray(envelope.Result.Data)) {
        console.log('[SB1Common] getDocumentNames → returning', envelope.Result.Data.length, 'items');
        return envelope.Result.Data;   // ← returns the flat array of TemplateReport objects
    }

    // Fallback: if it's already a flat array
    
    
    
    if (Array.isArray(envelope)) {
        return envelope;
    }

    throw new Error('[SB1Common] getDocumentNames: unexpected data shape – ' + JSON.stringify(envelope).slice(0, 300));
};


SB1Common.createPackage = async function (payload) {

    if (!payload) {
        throw new Error('[SB1Common] createPackage: payload is required.');
    }

    console.log('[SB1Common] createPackage → payload:', payload);

    let response;

    try {
        response = await fetch('/api/data/v9.1/sb1_createpackage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'OData-MaxVersion': '4.0',
                'OData-Version': '4.0'
            },
            body: JSON.stringify({
                sb1_packagepayload: typeof payload === "string"
                    ? payload
                    : JSON.stringify(payload)
            })
        });

    } catch (execErr) {
        throw new Error('[SB1Common] createPackage: fetch failed – ' + (execErr.message || execErr));
    }

    if (!response.ok) {
        throw new Error('[SB1Common] createPackage: API returned non-OK HTTP status.');
    }

    let result;

    try {
        result = await response.json();
    } catch (parseErr) {
        throw new Error('[SB1Common] createPackage: failed to parse response JSON.');
    }

    // ✅ RETURN AS-IS (NO parsing)
    if (!result || !result.sb1_response) {
        throw new Error('[SB1Common] createPackage: sb1_response is missing.');
    }

    console.log('[SB1Common] createPackage → raw response:', result.sb1_response);

    return result.sb1_response;
};

//pass context
// Store context
SB1Common._formContext = null;

SB1Common.passContext = function (executionContext) {
    console.log('[SB1Common] passContext → called');

    try {
        if (!executionContext) {
            console.error('[SB1Common] passContext → executionContext is NULL');
            return;
        }

        const formCtx = executionContext.getFormContext();

        if (!formCtx) {
            console.error('[SB1Common] passContext → formContext is NULL');
            return;
        }

        SB1Common._formContext = formCtx;

        console.log('[SB1Common] passContext → formContext stored successfully');
        console.log('[SB1Common] passContext → entity:', formCtx.data.entity.getEntityName());
        console.log('[SB1Common] passContext → recordId:', formCtx.data.entity.getId());

    } catch (e) {
        console.error('[SB1Common] passContext ERROR:', e);
    }
};
//Refresh form 
SB1Common.refreshForm = function (save = false) {
    console.log('[SB1Common] refreshForm → called with save =', save);

    try {
        if (!SB1Common._formContext) {
            console.warn('[SB1Common] refreshForm → No formContext available');
            return;
        }

        const formCtx = SB1Common._formContext;

        console.log('[SB1Common] refreshForm → entity:', formCtx.data.entity.getEntityName());
        console.log('[SB1Common] refreshForm → id:', formCtx.data.entity.getId());

        console.log('[SB1Common] refreshForm → triggering data.refresh...');

        formCtx.data.refresh(save).then(
            function success() {
                console.log('[SB1Common] refreshForm → SUCCESS: Form refreshed');
            },
            function error(err) {
                console.error('[SB1Common] refreshForm → ERROR:', err);
            }
        );

    } catch (e) {
        console.error('[SB1Common] refreshForm EXCEPTION:', e);
    }
};


SB1Common.renewQuoteDetails = async function (payload) {
    if (!payload || typeof payload !== 'object') {
        throw new Error('[SB1Common] renewQuoteDetails: payload must be a non-null object.');
    }

    // ── Log form type with a human-readable label ─────────────────────────────
    var formTypeLabels = { 1: 'Create', 2: 'Update', 3: 'Read Only', 4: 'Disabled', 6: 'Bulk Edit' };
    var formTypeLabel  = formTypeLabels[payload.form_type] || 'Unknown';
    console.log('[SB1Common] renewQuoteDetails → formType:', payload.form_type, '(' + formTypeLabel + ')');
    console.log('[SB1Common] renewQuoteDetails → payload:', JSON.stringify(payload, null, 2));

    // ── Call the Custom API ───────────────────────────────────────────────────
    var response;
    try {
        response = await fetch('/api/data/v9.1/sb1_renew_quote_custom_api', {
            method: 'POST',
            headers: {
                'Content-Type'    : 'application/json',
                'Accept'          : 'application/json',
                'OData-MaxVersion': '4.0',
                'OData-Version'   : '4.0'
            },
            body: JSON.stringify({
                sb1_quotepayloadforrenew : JSON.stringify(payload),
              
            })
        });
    } catch (fetchErr) {
        throw new Error('[SB1Common] renewQuoteDetails: fetch failed – ' + (fetchErr.message || fetchErr));
    }

    if (!response.ok) {
        var errText;
        try { errText = await response.text(); } catch (_) { errText = '(no body)'; }
        throw new Error('[SB1Common] renewQuoteDetails: API returned HTTP ' + response.status + ' – ' + errText);
    }

    // ── Parse outer envelope ──────────────────────────────────────────────────
    var envelope;
    try {
        envelope = await response.json();
    } catch (parseErr) {
        throw new Error('[SB1Common] renewQuoteDetails: failed to parse response JSON.');
    }

    if (!envelope || envelope.sb1_responseforrenew === undefined) {
        throw new Error('[SB1Common] renewQuoteDetails: sb1_responseforrenew is missing from the response.');
    }

    // ── Parse inner response string ───────────────────────────────────────────
    var parsed;
    try {
        parsed = typeof envelope.sb1_responseforrenew === 'string'
            ? JSON.parse(envelope.sb1_responseforrenew)
            : envelope.sb1_responseforrenew;
    } catch (jsonErr) {
        // Return raw string if it is not valid JSON
        parsed = envelope.sb1_responseforrenew;
    }

    console.log('[SB1Common] renewQuoteDetails → response received:', parsed);

    // ── Handle response properly ─────────────────────────────────────
if (!parsed || typeof parsed !== 'object') {
    return {
        success: false,
        message: 'Invalid response from server.'
    };
}

// ❌ ERROR CASE
if (!parsed.success) {
    console.warn('[SB1Common] renewQuoteDetails → Error:', parsed.message);

    return {
        success: false,
        message: parsed.message || 'Something went wrong.'
    };
}

// ✅ SUCCESS CASE
var createdId = parsed?.data?.CreatedQuoteId || null;

console.log('[SB1Common] renewQuoteDetails → Success. ID:', createdId);

return {
    success: true,
    message: parsed.message || 'Quote created successfully.',
    id: createdId
};
};

SB1Common.downloadCollateral = async function (sb1_forminstanceid, sb1_tempreportname, sb1_fileformat) {
    console.log('[SB1Common] downloadCollateral → called');

    if (!sb1_forminstanceid) throw new Error('[SB1Common] downloadCollateral: sb1_forminstanceid is required.');
    if (!sb1_tempreportname) throw new Error('[SB1Common] downloadCollateral: sb1_tempreportname is required.');
    if (!sb1_fileformat)     throw new Error('[SB1Common] downloadCollateral: sb1_fileformat is required.');

    console.log('[SB1Common] downloadCollateral → params:', {
        sb1_forminstanceid,
        sb1_tempreportname,
        sb1_fileformat
    });

    let response;
    try {
        response = await fetch('/api/data/v9.1/sb1_downloadcollateral', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'OData-MaxVersion': '4.0',
                'OData-Version': '4.0'
            },
            body: JSON.stringify({
                sb1_forminstanceid,
                sb1_tempreportname,
                sb1_fileformat
            })
        });
    } catch (fetchErr) {
        throw new Error('[SB1Common] downloadCollateral: fetch failed – ' + (fetchErr.message || fetchErr));
    }

    if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`[SB1Common] downloadCollateral: HTTP ${response.status} – ${errText}`);
    }

    let rawText;
    try {
        rawText = await response.text();
        console.log('[SB1Common] downloadCollateral → raw text length:', rawText.length);
        console.log('[SB1Common] downloadCollateral → first 500 chars:', rawText.substring(0, 500));
    } catch (textErr) {
        throw new Error('[SB1Common] downloadCollateral: failed to read response – ' + textErr.message);
    }

    let base64String = null;

    // ── Method 1: Try JSON.parse and check ALL keys ───────────────────────
    try {
        const json = JSON.parse(rawText);

        // 🔍 LOG ALL KEYS so we know exactly what Dataverse returned
        console.log('[SB1Common] downloadCollateral → response keys:', Object.keys(json));

        // Try every possible key name Dataverse might use
        base64String =
            json['sb1_response']                    ||  // standard output param name
            json['$content']                        ||  // Logic Apps / flow style
            json['FileContent']                     ||  // alternative
            json['fileContent']                     ||  // alternative lowercase
            json['Base64Content']                   ||  // alternative
            json['base64Content']                   ||  // alternative
            json['Result']                          ||  // some APIs wrap in Result
            json['result']                          ||
            null;

        // If still null, check if any value looks like a base64 string
        if (!base64String) {
            for (const [key, val] of Object.entries(json)) {
                if (typeof val === 'string' && val.length > 100 && /^[A-Za-z0-9+/=]+$/.test(val.substring(0, 50))) {
                    console.log(`[SB1Common] downloadCollateral → found base64-like value in key: "${key}", length: ${val.length}`);
                    base64String = val;
                    break;
                }
            }
        }

        if (base64String) {
            console.log('[SB1Common] downloadCollateral → extracted via JSON.parse, length:', base64String.length);
        }

    } catch (parseErr) {
        console.warn('[SB1Common] downloadCollateral → JSON.parse failed:', parseErr.message);
    }

    // ── Method 2: regex extract if JSON.parse didn't find it ─────────────
    if (!base64String) {
        // Try to find any long base64-like string value in the raw text
        const match = rawText.match(/"([A-Za-z0-9_]+)"\s*:\s*"(JV[A-Za-z0-9+/=]{50,})"/);
        if (match) {
            console.log(`[SB1Common] downloadCollateral → regex found base64 in key: "${match[1]}", length: ${match[2].length}`);
            base64String = match[2];
        }
    }

    // ── Method 3: raw text itself might be the base64 ────────────────────
    if (!base64String) {
        const trimmed = rawText.trim();
        if (trimmed.startsWith('JV') || /^[A-Za-z0-9+/=\r\n]+$/.test(trimmed.substring(0, 100))) {
            console.log('[SB1Common] downloadCollateral → treating raw text as base64, length:', trimmed.length);
            base64String = trimmed;
        }
    }

    if (!base64String) {
        throw new Error('[SB1Common] downloadCollateral: could not extract base64 content. Check console for response keys.');
    }

    // Strip surrounding quotes if any
    if (base64String.startsWith('"') && base64String.endsWith('"')) {
        base64String = base64String.slice(1, -1);
    }

    console.log('[SB1Common] downloadCollateral → base64 ready, length:', base64String.length);
    return base64String;
};

SB1Common.saveUpdatedQuoteDetails = async function (payload) {

    if (!payload) {
        throw new Error('[SB1Common] saveUpdatedQuoteDetails: payload is required.');
    }

    console.log('[SB1Common] saveUpdatedQuoteDetails → payload:', payload);

    let response;

    try {
        response = await fetch('/api/data/v9.1/sb1_updatequotedetailsandname', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'OData-MaxVersion': '4.0',
                'OData-Version': '4.0'
            },
            body: JSON.stringify({
                sb1_reqpayload: typeof payload === "string"
                    ? payload
                    : JSON.stringify(payload)
            })
        });

    } catch (execErr) {
        throw new Error('[SB1Common] saveUpdatedQuoteDetails: fetch failed – ' + (execErr.message || execErr));
    }

    if (!response.ok) {
        throw new Error('[SB1Common] saveUpdatedQuoteDetails: API returned non-OK HTTP status.');
    }

    let result;

    try {
        result = await response.json();
    } catch (parseErr) {
        throw new Error('[SB1Common] saveUpdatedQuoteDetails: failed to parse response JSON.');
    }

    // ✅ RETURN AS-IS (NO parsing)
    if (!result || !result.sb1_updateproductres) {
        throw new Error('[SB1Common] saveUpdatedQuoteDetails: sb1_response is missing.');
    }

    console.log('[SB1Common] saveUpdatedQuoteDetails → raw response:', result.sb1_updateproductres);

    return result.sb1_updateproductres;
};