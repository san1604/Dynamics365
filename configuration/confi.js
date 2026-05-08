// ── Tab switching ──
function switchTab(name) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    event.target.classList.add('active');
}

// ── Toast ──
function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    t.textContent = (type === 'success' ? '✓ ' : '✕ ') + msg;
    t.className = 'show ' + (type === 'success' ? 'success' : 'error-toast');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.className = '', 3000);
}

// ── Char counter ──
function updateChar(input, counterId, max) {
    const left = max - input.value.length;
    const el = document.getElementById(counterId);
    el.textContent = `Character Left: ${left}/${max}`;
    el.className = 'char-count' + (left < 5 ? ' warn' : '');
}

// ── Auth type toggle ──
function toggleAuthType() {
    const isSso = document.querySelector('[name="auth-type"]:checked').value === 'sso';
    document.getElementById('sso-fields').style.display = isSso ? '' : 'none';
    document.getElementById('creds-fields').style.display = isSso ? 'none' : '';
}

// ── Checkbox all/children sync ──
function toggleAll(group, allChk) {
    document.querySelectorAll('.' + group + '-child').forEach(c => c.checked = allChk.checked);
}
function syncParent(group) {
    const children = document.querySelectorAll('.' + group + '-child');
    const allChecked = [...children].every(c => c.checked);
    document.getElementById(group + '-all').checked = allChecked;
}

// ── Validation helpers ──
function showErr(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    const input = el.previousElementSibling?.tagName === 'DIV' ? el.previousElementSibling.querySelector('input') : el.previousElementSibling;
    if (input) input.classList.add('error');
}
function clearErr(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('show');
    const input = el.previousElementSibling?.tagName === 'DIV' ? el.previousElementSibling.querySelector('input') : el.previousElementSibling;
    if (input) input.classList.remove('error');
}
function required(id, errId, label) {
    const val = document.getElementById(id)?.value?.trim();
    if (!val) { showErr(errId, `${label} is required.`); return false; }
    clearErr(errId); return true;
}
function validUrl(id, errId) {
    const val = document.getElementById(id)?.value?.trim();
    if (!val) { showErr(errId, 'URL is required.'); return false; }
    try { new URL(val); clearErr(errId); return true; }
    catch { showErr(errId, 'Please enter a valid URL (https://...).'); return false; }
}
async function callGenerateTokenAPI(payload) {
    const XrmContext = window.parent?.Xrm || window.Xrm;

    if (!XrmContext) {
        showToast("Xrm not available", "error");
        return null;
    }

    const request = {
        sb1_requestJson: JSON.stringify(payload),

        getMetadata: function () {
            return {
                boundParameter: null,
                parameterTypes: {
                    sb1_requestJson: { typeName: "Edm.String", structuralProperty: 1 }
                },
                operationType: 0,
                operationName: "sb1_generateandstoretoken"
            };
        }
    };

    try {
        const response = await XrmContext.WebApi.online.execute(request);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        const parsed = JSON.parse(result.sb1_responseJson);

        return parsed;

    } catch (error) {
        console.error("Custom API Error:", error);
        showToast("Error calling Custom API", "error");
        return null;
    }
}
function setMultiSelectValue(id, valueString) {
    const container = document.getElementById(id);
    if (!container || !valueString) return;

    const values = valueString.split(",").map(v => v.trim());
    const checkboxes = container.querySelectorAll("input[type='checkbox']");
    const noneOption = container.querySelector(".none-option");

    // reset
    checkboxes.forEach(cb => cb.checked = false);

    values.forEach(val => {
        checkboxes.forEach(cb => {
            if (cb.value === val) cb.checked = true;
        });
    });

    // handle None
    if (values.includes("None")) {
        checkboxes.forEach(cb => {
            if (cb.value !== "None") cb.checked = false;
        });
    }

    // 🔥 trigger UI refresh
    updateMultiSelectDisplay(container);
}
function updateMultiSelectDisplay(container) {
    const display = container.querySelector(".multi-select-display");
    const checkboxes = container.querySelectorAll("input[type='checkbox']");
    const noneOption = container.querySelector(".none-option");

    const selected = [...checkboxes].filter(c => c.checked && c.value !== "None");

    if (noneOption.checked) {
        display.innerHTML = `<span class="chip">None</span>`;
        return;
    }

    if (selected.length === 0) {
        display.textContent = "Select states";
        return;
    }

    if (selected.length <= 2) {
        display.innerHTML = selected.map(s => `<span class="chip">${s.value}</span>`).join("");
    } else {
        display.innerHTML = `<span class="chip">${selected.length} States Selected</span>`;
    }
}
function getMultiSelectValue(id) {
    const container = document.getElementById(id);

    if (!container) {
        console.error("❌ Multi-select not found:", id);
        return null;
    }

    const checked = container.querySelectorAll("input[type='checkbox']:checked");

    if (checked.length === 0) return null;

    return Array.from(checked)
        .map(c => c.value)
        .join(", ");
}
// ── Form save ──
async function saveForm(form) {
    console.log("Saving form:", form);

    // 🔹 CORE USER (SSO / Credentials)
    if (form === 'core-user') {

        const authType = document.querySelector('input[name="auth-type"]:checked').value;

        // =========================
        // 🔹 SSO FLOW (EXISTING)
        // =========================
        if (authType === "sso") {

            const tenantId = document.getElementById("ud-tenant").value.trim();
            const clientId = document.getElementById("ud-clientid").value.trim();
            const clientSecret = document.getElementById("ud-secret").value.trim();
            const scope = document.getElementById("ud-scope").value.trim();

            if (!tenantId || !clientId || !clientSecret || !scope) {
                showToast("All SSO fields are required", "error");
                return;
            }

            const payload = {
                tenantId,
                clientId,
                clientSecret,
                grantType: "client_credentials",
                scope
            };

            const XrmContext = window.parent?.Xrm || window.Xrm;

            if (!XrmContext) {
                showToast("Xrm not available", "error");
                return;
            }

            const request = {
                sb1_requestJson: JSON.stringify(payload),

                getMetadata: function () {
                    return {
                        boundParameter: null,
                        parameterTypes: {
                            sb1_requestJson: { typeName: "Edm.String", structuralProperty: 1 }
                        },
                        operationType: 0,
                        operationName: "sb1_generateandstoretoken"
                    };
                }
            };

            try {
                showToast("Authenticating...", "success");

                const response = await XrmContext.WebApi.online.execute(request);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const result = await response.json();
                const parsed = JSON.parse(result.sb1_responseJson);

                console.log("SSO API Result:", parsed);

                if (parsed.isSuccess) {
                    showToast("Authentication successful!", "success");
                } else {
                    let errorMsg = "Authentication failed";

                    try {
                        if (parsed.error) {
                            const errObj = typeof parsed.error === "string"
                                ? JSON.parse(parsed.error)
                                : parsed.error;

                            errorMsg = errObj.error_description || errObj.error || errorMsg;

                            if (errorMsg.includes("AADSTS7000215")) {
                                errorMsg = "Invalid Client Secret. Please check and try again.";
                            }
                        }
                    } catch (e) {
                        console.warn("Error parsing error", e);
                    }

                    showToast(errorMsg, "error");
                    return;
                }

            } catch (error) {
                console.error("SSO API Error:", error);
                showToast("Error calling SSO API", "error");
                return;
            }
        }


        // =========================
        // 🔹 USER CREDENTIAL FLOW (NEW)
        // =========================
        else {
            console.log("Using User Credential flow");
            let valid =
                required('ud-username', 'ud-username-err', 'Username') &
                required('ud-password', 'ud-password-err', 'Password');

            if (!valid) {
                showToast('Please fix the errors before saving.', 'error');
                return;
            }

            const username = document.getElementById("ud-username").value.trim();
            const password = document.getElementById("ud-password").value.trim();

            const payload = {
                username: username,
                password: password
            };

            const XrmContext = window.parent?.Xrm || window.Xrm;

            if (!XrmContext) {
                showToast("Xrm not available", "error");
                return;
            }

            const request = {
                sb1_authrequestjson: JSON.stringify(payload),

                getMetadata: function () {
                    return {
                        boundParameter: null,
                        parameterTypes: {
                            "sb1_authrequestjson": {
                                typeName: "Edm.String",
                                structuralProperty: 1
                            }
                        },
                        operationType: 0,
                        operationName: "sb1_authenticate_user_and_update_config"
                    };
                }
            };

            try {
                showToast("Authenticating...", "success");

                const response = await XrmContext.WebApi.online.execute(request);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const result = await response.json();

                console.log("Credentials API Response:", result);

                const statusCode = result.sb1_authresponse;

                if (statusCode === "200") {
                    showToast("Authentication successful!", "success");
                } else {
                    showToast("Authentication failed. Status: " + statusCode, "error");
                    return;
                }

            } catch (error) {
                console.error("Credentials API Error:", error);
                showToast("Error calling authentication API", "error");
                return;
            }
        }
    }

    else if (form === 'workflow') {

        console.log("🔥 WORKFLOW BLOCK HIT");
        console.log("NEW INTERNAL:", getMultiSelectValue("wf-new-internal"));
        console.log("RENEW INTERNAL:", getMultiSelectValue("wf-renew-internal"))
        console.log("BROKER NEW:", getMultiSelectValue("wf-new-broker"));
        console.log("BROKER RENEW:", getMultiSelectValue("wf-renew-broker"));
        const XrmContext = window.parent?.Xrm || window.Xrm;

        if (!XrmContext) {
            console.error("❌ Xrm not available");
            showToast("Xrm not available", "error");
            return;
        }

        const getValue = (id) => document.getElementById(id)?.value || null;

        const data = {
            sb1_submitquoteforpricingpremiumfornew: getValue("wf-new-pricing"),
            sb1_submitquoteforpricingpremiumforrenew: getValue("wf-renew-pricing"),
            sb1_triggerexceptionalapprovalfornew: getValue("wf-new-approval"),
            sb1_triggerexceptionalapprovalforrenew: getValue("wf-renew-approval"),
            sb1_quotestateifrejectedfornew: getValue("wf-new-rejected"),
            sb1_quotestateifrejectedforrenew: getValue("wf-renew-rejected"),
            sb1_internalreviewfornew: getMultiSelectValue("wf-new-internal"),
            sb1_internalreviewforrenew: getMultiSelectValue("wf-renew-internal"),
            sb1_brokervalidationfornew: getMultiSelectValue("wf-new-broker"),
            sb1_brokervalidationforrenew: getMultiSelectValue("wf-renew-broker"),
        };

        console.log("📦 Workflow Data:", data);

        try {

            showToast("Saving workflow...", "success");

            // 🔹 Check existing record
            const result = await XrmContext.WebApi.retrieveMultipleRecords(
                "sb1_quoteworkflowconfiguration",
                "?$top=1"
            );

            console.log("🔹 Retrieved:", result.entities);

            if (result.entities.length > 0) {

                // ✅ UPDATE
                const recordId = result.entities[0].sb1_quoteworkflowconfigurationid;

                await XrmContext.WebApi.updateRecord(
                    "sb1_quoteworkflowconfiguration",
                    recordId,
                    data
                );

                console.log("✅ Updated record:", recordId);
                showToast("Workflow updated successfully!");

            } else {

                // ✅ CREATE
                const createResult = await XrmContext.WebApi.createRecord(
                    "sb1_quoteworkflowconfiguration",
                    data
                );

                console.log("✅ Created record:", createResult.id);
                showToast("Workflow created successfully!");
            }

        } catch (error) {
            console.error("❌ Error:", error);
            showToast("Error saving workflow", "error");
        }

        return;
    }
    else if (form === 'stage-mapping') {

        console.log("🔥 Stage Mapping Save Started");

        const XrmContext = window.parent?.Xrm || window.Xrm;

        if (!XrmContext) {
            console.error("❌ Xrm not available");
            showToast("Xrm not available", "error");
            return;
        }

        const get = (id) => {
            const el = document.getElementById(id);
            console.log(`🔍 Getting value for ${id}:`, el?.value);
            return el?.value || null;
        };

        const data = {

            sb1_draftquotestatusfornew: get("stage-draft-new"),
            sb1_draftquotestatusforrenew: get("stage-draft-renew"),

            sb1_inreviewquotestatusfornew: get("stage-inreview-new"),
            sb1_inreviewquotestatusforrenew: get("stage-inreview-renew"),

            sb1_approvedquotestatusfornew: get("stage-approved-new"),
            sb1_approvedquotestatusforrenew: get("stage-approved-renew"),

            sb1_presentedquotestatusfornew: get("stage-presented-new"),
            sb1_presentedsquotestatusforrenew: get("stage-presented-renew"),

            sb1_acceptedquotestatusfornew: get("stage-accepted-new"),
            sb1_acceptedquotestatusforrenew: get("stage-accepted-renew")
        };

        console.log("📦 Final Payload to Dataverse:", JSON.stringify(data, null, 2));

        try {

            console.log("🔄 Fetching existing record...");

            const result = await XrmContext.WebApi.retrieveMultipleRecords(
                "sb1_quoteworkflowconfiguration",
                "?$top=1"
            );

            console.log("📥 Retrieved Records:", result.entities);

            if (result.entities.length > 0) {

                const record = result.entities[0];
                const id = record.sb1_quoteworkflowconfigurationid;

                console.log("✏️ Updating record with ID:", id);

                await XrmContext.WebApi.updateRecord(
                    "sb1_quoteworkflowconfiguration",
                    id,
                    data
                );

                console.log("✅ Update successful for ID:", id);
                showToast("Stage mapping updated successfully");

            } else {

                console.log("➕ No record found. Creating new record...");

                const createResult = await XrmContext.WebApi.createRecord(
                    "sb1_quoteworkflowconfiguration",
                    data
                );

                console.log("✅ Created new record ID:", createResult.id);
                showToast("Stage mapping created successfully");
            }

        } catch (error) {

            console.error("❌ ERROR while saving stage mapping:");
            console.error("Message:", error.message);
            console.error("Full Error:", error);

            showToast("Error saving stage mapping", "error");
        }

        console.log("🏁 Stage Mapping Save Finished");

        return;
    }
    else if (form === 'tags') {

        console.log("🔥 Saving Tags");

        const XrmContext = window.parent?.Xrm || window.Xrm;

        if (!XrmContext) {
            showToast("Xrm not available", "error");
            return;
        }

        const medical = document.getElementById("pt-medical")?.checked;
        const rx = document.getElementById("pt-rx")?.checked;
        const dental = document.getElementById("pt-dental")?.checked;
        const vision = document.getElementById("pt-vision")?.checked;

        // 🔹 Module Types
        const plan = document.getElementById("mt-plan")?.checked;
        const variant = document.getElementById("mt-variant")?.checked;
        const blueprint = document.getElementById("mt-blueprint")?.checked;

        const allModule = plan && variant && blueprint;

        // 🔹 Same as Power Apps IF condition
        const allProduct = medical && rx && dental && vision;

        const data = {

            sb1_marketsegmenttags: document.getElementById("tag-market")?.checked ? "yes" : "no",
            sb1_fundingarrangementtags: document.getElementById("tag-funding")?.checked ? "yes" : "no",
            sb1_allowallversion: document.getElementById("vs-all")?.checked ? "yes" : "no",
            sb1_regiontags: document.getElementById("tag-region")?.checked ? "yes" : "no",
            sb1_statetags: document.getElementById("tag-state")?.checked ? "yes" : "no",

            sb1_allowallproduct: allProduct ? "yes" : "no",

            sb1_allowmedicalproduct: medical ? "yes" : "no",
            sb1_allowdentalproduct: dental ? "yes" : "no",
            sb1_allowrxproducts: rx ? "yes" : "no",
            sb1_allowvisionproduct: vision ? "yes" : "no",

            // 🔹 Module Types
            sb1_allowallmodule: allModule ? "yes" : "no",
            sb1_allowplanmodule: plan ? "yes" : "no",
            sb1_allowvariantmodule: variant ? "yes" : "no",
            sb1_allowblueprintmodule: blueprint ? "yes" : "no"
        };
        console.log("📦 Tags Payload:", data);

        try {
            const result = await XrmContext.WebApi.retrieveMultipleRecords(
                "sb1_quoteworkflowconfiguration",
                "?$top=1"
            );

            if (result.entities.length > 0) {

                const id = result.entities[0].sb1_quoteworkflowconfigurationid;

                await XrmContext.WebApi.updateRecord(
                    "sb1_quoteworkflowconfiguration",
                    id,
                    data
                );

                console.log("✅ Updated");
                showToast("Tag configuration updated successfully");

            } else {

                const res = await XrmContext.WebApi.createRecord(
                    "sb1_quoteworkflowconfiguration",
                    data
                );

                console.log("✅ Created:", res.id);
                showToast("Tag configuration created successfully");
            }

        } catch (e) {
            console.error("❌ Error:", e);
            showToast("Error saving tags", "error");
        }

        return;
    }

    // =========================
    // 🔹 OTHER FORMS (UNCHANGED)
    // =========================

    let valid = true;

    if (form === 'core-company') {
        valid =
            required('cc-tenant', 'cc-tenant-err', 'Tenant ID') &
            validUrl('cc-domain', 'cc-domain-err') &
            required('cc-qobj', 'cc-qobj-err', 'Quote Object API') &
            required('cc-rectype', 'cc-rectype-err', 'Record Type Name') &
            required('cc-qacc', 'cc-qacc-err', 'Quote-Account Relationship Name') &
            required('cc-qstage', 'cc-qstage-err', 'Quote Stage Field API Name');
    }
    else if (form === 'smart-config') {

        let valid = validUrl('sc-domain', 'sc-domain-err');

        if (!valid) {
            showToast('Please enter valid URL', 'error');
            return;
        }

        const domainUrl = document.getElementById("sc-domain").value.trim();

        const payload = {
            domainurl: domainUrl
        };

        const XrmContext = window.parent?.Xrm || window.Xrm;

        if (!XrmContext) {
            showToast("Xrm not available", "error");
            return;
        }

        const request = {
            sb1_smartconfigrequestjson: JSON.stringify(payload),

            getMetadata: function () {
                return {
                    boundParameter: null,
                    parameterTypes: {
                        "sb1_smartconfigrequestjson": {
                            typeName: "Edm.String",
                            structuralProperty: 1
                        }
                    },
                    operationType: 0,
                    operationName: "sb1_update_smartconfig"
                };
            }
        };

        try {
            showToast("Calling API...", "success");

            const response = await XrmContext.WebApi.online.execute(request);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            console.log("Smart Config Response:", result);

            const statusCode = result.sb1_smartconfigresponse;

            if (statusCode === "200" || statusCode === "204") {
                showToast("Smart Config updated successfully!", "success");
            } else {
                showToast("API failed. Status: " + statusCode, "error");
            }

        } catch (error) {
            console.error("Smart Config API Error:", error);
            showToast("Error calling Smart Config API", "error");
        }
    }
    else if (form === 'broker') {

        console.log("🔥 Saving Broker Config");

        const XrmContext = window.parent?.Xrm || window.Xrm;

        if (!XrmContext) {
            showToast("Xrm not available", "error");
            return;
        }

        let valid =
            required('bc-detail', 'bc-detail-err', 'Broker Detail') &
            required('bc-avgage', 'bc-avgage-err', 'Average Age') &
            required('bc-people', 'bc-people-err', 'Number of People') &
            required('bc-minage', 'bc-minage-err', 'Min Age') &
            required('bc-maxage', 'bc-maxage-err', 'Max Age') &
            required('bc-subs', 'bc-subs-err', 'Number of Subscribers');

        if (!valid) {
            showToast('Please fix the errors before saving.', 'error');
            return;
        }

        const data = {
            sb1_brokerdetails: document.getElementById("bc-detail").value.trim(),
            sb1_averageage: document.getElementById("bc-avgage").value.trim(),
            sb1_numberofpeople: document.getElementById("bc-people").value.trim(),
            sb1_minage: document.getElementById("bc-minage").value.trim(),
            sb1_maxage: document.getElementById("bc-maxage").value.trim(),
            sb1_numberofsubscriber: document.getElementById("bc-subs").value.trim()
        };

        console.log("📦 Broker Payload:", data);

        try {

            const result = await XrmContext.WebApi.retrieveMultipleRecords(
                "sb1_quoteworkflowconfiguration",
                "?$top=1"
            );

            if (result.entities.length > 0) {

                const id = result.entities[0].sb1_quoteworkflowconfigurationid;

                await XrmContext.WebApi.updateRecord(
                    "sb1_quoteworkflowconfiguration",
                    id,
                    data
                );

                console.log("✅ Broker updated");
                showToast("Broker configuration updated successfully");

            } else {

                const res = await XrmContext.WebApi.createRecord(
                    "sb1_quoteworkflowconfiguration",
                    data
                );

                console.log("✅ Broker created:", res.id);
                showToast("Broker configuration created successfully");
            }

        } catch (e) {
            console.error("❌ Error saving broker:", e);
            showToast("Error saving broker configuration", "error");
        }

        return;
    }
    else if (form === 'stage-sync') {
        valid = validUrl('ss-domain', 'ss-domain-err');
    }
    else if (form === 'range-config') {

        console.log("🔥 Saving Range Configuration");

        const XrmContext = window.parent?.Xrm || window.Xrm;
        if (!XrmContext) {
            showToast("Xrm not available", "error");
            return;
        }

        const yesNo = (val) => val ? "yes" : "no";

        function getNum(id) {
            const el = document.getElementById(id);
            if (!el || el.value === "" || el.value === null) return "0";
            return el.value.toString(); // ✅ TEXT ONLY
        }

        const isOn = (id) => document.getElementById(id)?.checked;

        const data = {

            sb1_allowdeductible: yesNo(isOn('rc-deductible')),
            sb1_deductibleminvalue: getNum('rc-deductible-min'),
            sb1_deductiblemaxvalue: getNum('rc-deductible-max'),

            sb1_allowcoinsurance: yesNo(isOn('rc-coinsurance')),
            sb1_coinsuranceminvalue: getNum('rc-coinsurance-min'),
            sb1_coinsurancemaxvalue: getNum('rc-coinsurance-max'),

            sb1_allowoopm: yesNo(isOn('rc-oopm')),
            sb1_oopmminvalue: getNum('rc-oopm-min'),
            sb1_oopmmaxvalue: getNum('rc-oopm-max'),

            sb1_allowspecialvisit: yesNo(isOn('rc-specialist')),
            sb1_specialvisitminvalue: getNum('rc-specialist-min'),
            sb1_specialvisitmaxvalue: getNum('rc-specialist-max'),

            sb1_allowofficevisit: yesNo(isOn('rc-office')),
            sb1_officevisitminvalue: getNum('rc-office-min'),
            sb1_officevisitmaxvalue: getNum('rc-office-max'),

            sb1_allowurgentcare: yesNo(isOn('rc-urgent')),
            sb1_urgentcareminvalue: getNum('rc-urgent-min'),
            sb1_urgentcaremaxvalue: getNum('rc-urgent-max'),

            sb1_allowprimarycarevisit: yesNo(isOn('rc-primarycare')),
            sb1_primarycarevisitminvalue: getNum('rc-primarycare-min'),
            sb1_primarycarevisitmaxvalue: getNum('rc-primarycare-max'),

            sb1_allowwellbabyvisit: yesNo(isOn('rc-wellbaby')),
            sb1_wellbabyvisitminvalue: getNum('rc-wellbaby-min'),
            sb1_wellbabyvisitmaxvalue: getNum('rc-wellbaby-max'),

            sb1_allowemergencyvisit: yesNo(isOn('rc-emergency')),
            sb1_emergencyvisitminvalue: getNum('rc-emergency-min'),
            sb1_emergencyvvisitmaxvalue: getNum('rc-emergency-max'),
        };

        console.log("📦 FINAL PAYLOAD:", data);

        try {

            const result = await XrmContext.WebApi.retrieveMultipleRecords(
                "sb1_quoteworkflowconfiguration",
                "?$top=1"
            );

            if (result.entities.length > 0) {
                const id = result.entities[0].sb1_quoteworkflowconfigurationid;

                await XrmContext.WebApi.updateRecord(
                    "sb1_quoteworkflowconfiguration",
                    id,
                    data
                );

                showToast("Range configuration updated successfully");

            } else {

                await XrmContext.WebApi.createRecord(
                    "sb1_quoteworkflowconfiguration",
                    data
                );

                showToast("Range configuration created successfully");
            }

            await loadRangeConfig();

        } catch (e) {
            console.error("❌ FINAL ERROR:", e);
            showToast("Error saving range configuration", "error");
        }

        return;
    }

    else if (form === 'tags') {
        const minV = parseFloat(document.getElementById('ded-min').value);
        const maxV = parseFloat(document.getElementById('ded-max').value);

        if (isNaN(minV) || minV < 0) {
            showErr('ded-min-err', 'Min value must be ≥ 0.');
            valid = false;
        } else clearErr('ded-min-err');

        if (isNaN(maxV) || maxV <= minV) {
            showErr('ded-max-err', 'Max value must be greater than Min value.');
            valid = false;
        } else clearErr('ded-max-err');
    }

    if (valid) {
        showToast('Saved successfully!');
    } else {
        showToast('Please fix the errors before saving.', 'error');
    }
}
document.addEventListener("DOMContentLoaded", function () {
    console.log("🚀 Page Loaded");
    loadStageMapping();
    initMultiSelect("wf-new-internal");
    initMultiSelect("wf-renew-internal");
    initMultiSelect("wf-new-broker");
    initMultiSelect("wf-renew-broker");
    loadWorkflowConfig();
    loadTagsConfig();
    loadRangeConfig();
});

// ── Import ──
function startImport(btn) {
    btn.disabled = true;
    btn.textContent = 'Importing…';
    setTimeout(() => {
        btn.disabled = false;
        btn.textContent = 'Start Import';
        showToast('Import started! Check back for status.');
    }, 2200);
}

// ── File upload ──
function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) { showToast('Only .json files are accepted.', 'error'); input.value = ''; return; }
    document.getElementById('upload-status').textContent = `✓ "${file.name}" ready to upload`;
    document.getElementById('upload-zone').style.borderColor = 'var(--green)';
    showToast('File selected: ' + file.name);
}

// ── Download JSON ──
function downloadJSON() {
    const data = JSON.stringify({ config: "admin", version: "1.0" }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'admin-config.json'; a.click();
}

// ── Add relationship ──
let relCount = 3;
function addRelationship() {
    const name = prompt('Enter relationship name:');
    if (!name || !name.trim()) return;
    const id = 'rel' + relCount++;
    const div = document.createElement('div'); div.className = 'rel-row';
    div.innerHTML = `<input type="checkbox" id="${id}"><label for="${id}" style="cursor:pointer"><span>${name.trim()}</span></label>`;
    document.getElementById('rel-list').appendChild(div);
}
async function loadWorkflowConfig() {

    console.log("🔄 Loading Workflow Config...");

    const XrmContext = window.parent?.Xrm || window.Xrm;

    if (!XrmContext) {
        console.error("❌ Xrm not available");
        return;
    }

    try {

        const result = await XrmContext.WebApi.retrieveMultipleRecords(
            "sb1_quoteworkflowconfiguration",
            "?$top=1"
        );

        if (result.entities.length === 0) {
            console.warn("⚠️ No workflow config found");
            return;
        }

        const record = result.entities[0];

        console.log("📥 Workflow Record:", record);

        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (!el) {
                console.warn(`❌ Element not found: ${id}`);
                return;
            }
            el.value = value || "";
        };

        // 🔹 NEW
        setValue("wf-new-pricing", record.sb1_submitquoteforpricingpremiumfornew);
        setValue("wf-new-approval", record.sb1_triggerexceptionalapprovalfornew);
        setValue("wf-new-rejected", record.sb1_quotestateifrejectedfornew);
        setMultiSelectValue("wf-new-internal", record.sb1_internalreviewfornew);
        setMultiSelectValue("wf-new-broker", record.sb1_brokervalidationfornew);

        // 🔹 RENEW
        setValue("wf-renew-pricing", record.sb1_submitquoteforpricingpremiumforrenew);
        setValue("wf-renew-approval", record.sb1_triggerexceptionalapprovalforrenew);
        setValue("wf-renew-rejected", record.sb1_quotestateifrejectedforrenew);
        setValue("wf-renew-internal", record.sb1_internalreviewforrenew);
        setMultiSelectValue("wf-renew-internal", record.sb1_internalreviewforrenew);
        setMultiSelectValue("wf-renew-broker", record.sb1_brokervalidationforrenew);

        console.log("✅ Workflow Config Loaded");

    } catch (error) {
        console.error("❌ Error loading workflow config:", error);
    }
}
async function loadTagsConfig() {

    console.log("🔄 Loading Tags...");

    const XrmContext = window.parent?.Xrm || window.Xrm;
    if (!XrmContext) return;

    try {
        const result = await XrmContext.WebApi.retrieveMultipleRecords(
            "sb1_quoteworkflowconfiguration",
            "?$top=1"
        );

        if (result.entities.length === 0) return;

        const r = result.entities[0];

        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.checked = !!val;
        };

        set("tag-market", r.sb1_marketsegmenttags);
        set("tag-funding", r.sb1_fundingarrangementtags);
        set("vs-all", r.sb1_allowallversion);
        set("tag-region", r.sb1_regiontags);
        set("tag-state", r.sb1_statetags);

        set("pt-medical", r.sb1_allowmedicalproduct);
        set("pt-dental", r.sb1_allowdentalproduct);
        set("pt-rx", r.sb1_allowrxproducts);
        set("pt-vision", r.sb1_allowvisionproduct);

        set("pt-all", r.sb1_allowallproduct);

        set("mt-plan", r.sb1_allowplanmodule);
        set("mt-variant", r.sb1_allowvariantmodule);
        set("mt-blueprint", r.sb1_allowblueprintmodule);
        set("mt-all", r.sb1_allowallmodule);

        console.log("✅ Tags Loaded");

    } catch (e) {
        console.error("❌ Load error:", e);
    }
}
async function loadRangeConfig() {

    console.log("🔄 Loading Range Config...");

    const XrmContext = window.parent?.Xrm || window.Xrm;
    if (!XrmContext) return;

    try {

        const result = await XrmContext.WebApi.retrieveMultipleRecords(
            "sb1_quoteworkflowconfiguration",
            "?$top=1"
        );

        if (result.entities.length === 0) return;

        const r = result.entities[0];

        const setNum = (id, val) => {
            const el = document.getElementById(id);
            if (el && val !== null && val !== undefined) {
                el.value = val;
            }
        };

        const setChk = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.checked = val === "yes";
        };

        // ✅ Deductible
        setChk("rc-deductible", r.sb1_allowdeductible);
        setNum("rc-deductible-min", r.sb1_deductibleminvalue);
        setNum("rc-deductible-max", r.sb1_deductiblemaxvalue);

        // ✅ Coinsurance
        setChk("rc-coinsurance", r.sb1_allowcoinsurance);
        setNum("rc-coinsurance-min", r.sb1_coinsuranceminvalue);
        setNum("rc-coinsurance-max", r.sb1_coinsurancemaxvalue);

        // ✅ OOPM
        setChk("rc-oopm", r.sb1_allowoopm);
        setNum("rc-oopm-min", r.sb1_oopmminvalue);
        setNum("rc-oopm-max", r.sb1_oopmmaxvalue);

        // ✅ Specialist
        setChk("rc-specialist", r.sb1_allowspecialvisit);
        setNum("rc-specialist-min", r.sb1_specialvisitminvalue);
        setNum("rc-specialist-max", r.sb1_specialvisitmaxvalue);

        // ✅ Office
        setChk("rc-office", r.sb1_allowofficevisit);
        setNum("rc-office-min", r.sb1_officevisitminvalue);
        setNum("rc-office-max", r.sb1_officevisitmaxvalue);

        // ✅ Urgent
        setChk("rc-urgent", r.sb1_allowurgentcare);
        setNum("rc-urgent-min", r.sb1_urgentcareminvalue);
        setNum("rc-urgent-max", r.sb1_urgentcaremaxvalue);

        // ✅ Primary Care
        setChk("rc-primarycare", r.sb1_allowprimarycarevisit);
        setNum("rc-primarycare-min", r.sb1_primarycarevisitminvalue);
        setNum("rc-primarycare-max", r.sb1_primarycarevisitmaxvalue);

        // ✅ Well Baby
        setChk("rc-wellbaby", r.sb1_allowwellbabyvisit);
        setNum("rc-wellbaby-min", r.sb1_wellbabyvisitminvalue);
        setNum("rc-wellbaby-max", r.sb1_wellbabyvisitmaxvalue);

        // ✅ Emergency (typo stays same)
        setChk("rc-emergency", r.sb1_allowemergencyvisit);
        setNum("rc-emergency-min", r.sb1_emergencyvisitminvalue);
        setNum("rc-emergency-max", r.sb1_emergencyvvisitmaxvalue);

        // 🔥 Apply enable/disable UI
        document.querySelectorAll('[id^="rc-"][type="checkbox"]').forEach(chk => {
            toggleRangeFields(chk.id.replace("rc-", ""), chk);
        });

        console.log("✅ Loaded");

    } catch (e) {
        console.error("❌ Load error:", e);
    }
}
async function loadStageMapping() {

    console.log("🔄 Loading Stage Mapping...");

    const XrmContext = window.parent?.Xrm || window.Xrm;

    if (!XrmContext) {
        console.error("❌ Xrm not available");
        return;
    }

    try {

        const result = await XrmContext.WebApi.retrieveMultipleRecords(
            "sb1_quoteworkflowconfiguration",
            "?$top=1"
        );

        if (result.entities.length === 0) {
            console.warn("⚠️ No configuration record found");
            return;
        }

        const record = result.entities[0];

        console.log("📥 Loaded Record:", record);

        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (!el) {
                console.warn(`❌ Element not found: ${id}`);
                return;
            }
            el.value = value || "";
        };

        // 🔹 Set values
        setValue("stage-draft-new", record.sb1_draftquotestatusfornew);
        setValue("stage-draft-renew", record.sb1_draftquotestatusforrenew);

        setValue("stage-inreview-new", record.sb1_inreviewquotestatusfornew);
        setValue("stage-inreview-renew", record.sb1_inreviewquotestatusforrenew);

        setValue("stage-approved-new", record.sb1_approvedquotestatusfornew);
        setValue("stage-approved-renew", record.sb1_approvedquotestatusforrenew);

        setValue("stage-presented-new", record.sb1_presentedquotestatusfornew);
        setValue("stage-presented-renew", record.sb1_presentedsquotestatusforrenew);

        setValue("stage-accepted-new", record.sb1_acceptedquotestatusfornew);
        setValue("stage-accepted-renew", record.sb1_acceptedquotestatusforrenew);

        console.log("✅ Stage Mapping Loaded into UI");

    } catch (error) {
        console.error("❌ Error loading stage mapping:", error);
    }
}
function initMultiSelect(id) {
    const container = document.getElementById(id);
    const display = container.querySelector(".multi-select-display");
    const dropdown = container.querySelector(".multi-select-dropdown");
    const checkboxes = container.querySelectorAll("input[type='checkbox']");
    const noneOption = container.querySelector(".none-option");

    // ✅ Open / Close only when clicking display
    display.addEventListener("click", (e) => {
        e.stopPropagation();

        // close others first (optional but nice UX)
        document.querySelectorAll(".multi-select").forEach(ms => {
            if (ms !== container) ms.classList.remove("open");
        });

        container.classList.toggle("open");
    });

    // ✅ Prevent dropdown clicks from closing it
    dropdown.addEventListener("click", (e) => {
        e.stopPropagation();
    });

    // ✅ Checkbox logic
    checkboxes.forEach(cb => {
        cb.addEventListener("change", () => {

            const selected = [...checkboxes].filter(c => c.checked);

            // 🔥 RULE 1: If "None" selected → clear others
            if (cb.value === "None" && cb.checked) {
                checkboxes.forEach(c => {
                    if (c.value !== "None") c.checked = false;
                });
            }

            // 🔥 RULE 2: If others selected → uncheck None
            if (cb.value !== "None" && cb.checked) {
                noneOption.checked = false;
            }

            // 🔥 RULE 3: Block selecting None if others exist
            if (cb.value === "None" && selected.length > 1) {
                cb.checked = false;
                showToast("Unselect others before selecting 'None'", "error");
                return;
            }

            updateMultiSelectDisplay(container);
        });
    });

    // ✅ Close when clicking anywhere outside
    document.addEventListener("click", () => {
        container.classList.remove("open");
    });

    function updateDisplay() {
        const selected = [...checkboxes].filter(c => c.checked && c.value !== "None");

        if (noneOption.checked) {
            display.innerHTML = `<span class="chip">None</span>`;
            return;
        }

        if (selected.length === 0) {
            display.textContent = "Select states";
            return;
        }

        if (selected.length <= 2) {
            display.innerHTML = selected
                .map(s => `<span class="chip">${s.value}</span>`)
                .join("");
        } else {
            display.innerHTML = `<span class="chip">${selected.length} States Selected</span>`;
        }
    }
}

// ── Range Configuration toggle ──
function toggleRangeFields(key, chk) {
    const fields = document.getElementById('rc-' + key + '-fields');
    if (fields) fields.style.opacity = chk.checked ? '1' : '0.4';
    if (fields) fields.querySelectorAll('input').forEach(i => i.disabled = !chk.checked);
}

function deleteRelationships() {
    const checked = document.querySelectorAll('#rel-list input[type="checkbox"]:checked');
    if (!checked.length) { showToast('Select at least one relationship to delete.', 'error'); return; }
    checked.forEach(c => c.closest('.rel-row').remove());
    showToast('Deleted ' + checked.length + ' relationship(s).');
}

document.querySelectorAll('input[type="url"]').forEach(inp => {
    inp.addEventListener('blur', () => {
        if (!inp.value.trim()) return;
        try { new URL(inp.value.trim()); inp.classList.remove('error'); }
        catch { inp.classList.add('error'); }
    });
});

async function callBNI() {
    const spinner = document.getElementById('bni-spinner');

    // 1. Gather inputs
    const tenantId = document.getElementById('bni-tenant').value.trim();
    const clientId = document.getElementById('bni-clientid').value.trim();
    const clientSecret = document.getElementById('bni-secret').value.trim();
    const domainUrl = document.getElementById('bni-domain').value.trim();
    const scope = document.getElementById('bni-scope').value.trim();
    const baseUrl = document.getElementById('bni-baseurl').value.trim();

    if (!tenantId || !clientId || !clientSecret || !domainUrl || !scope || !baseUrl) {
        showToast('All BNI fields are required.', 'error');
        return null;
    }

    if (spinner) spinner.style.display = 'block';

    try {
        const response = await fetch('/api/data/v9.1/sb1_get_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'OData-MaxVersion': '4.0',
                'OData-Version': '4.0',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                sb1_bnitokenapi: baseUrl,
                sb1_bniclientid: clientId,
                sb1_bnisecret: clientSecret,
                sb1_bniscope: scope,
                sb1_bnidomainurl: domainUrl,
                sb1_bnitenantid: tenantId,
                sb1_bniquestion: "Give me medical products"
            }),
        });

        // 2. Check if the HTTP request itself failed (e.g., 404 or 500)
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData?.error?.message || `HTTP ${response.status}`);
        }

        const data = await response.json();
        const apiResponse = data?.sb1_apiresponse;

        // 3. Handle the "error" prefix returned by your Plugin
        if (apiResponse && apiResponse.startsWith("Token Error")) {
            if (apiResponse.includes("invalid_client")) {
                showToast('Invalid Secret. Please check your Secret', 'error');
                return null;
            }
            if (apiResponse.includes("unauthorized_client")) {
                showToast('Invalid Client. Please check your Client ID', 'error');
                return null;
            }
            if (apiResponse.includes("invalid_resource")) {
                showToast('Invalid Scope. Please check your Scope.', 'error');
                return null;
            }
        }
        else if (apiResponse && apiResponse == '{"detail":"Internal Server Error. Contact support."}') {
            showToast('Internal Server Error. Contact support.', 'error');
            return null;
        }
        try {
            const parsedData = JSON.parse(apiResponse);

            if (parsedData.Result && parsedData.Result.Status === "Success") {
                showToast('Details updated successfully!', 'success');
                return parsedData;
            } else {
                const errorMsg = parsedData.Result?.Message || 'API returned an unsuccessful status.';
                showToast(errorMsg, 'error');
                return parsedData;
            }
        } catch (parseError) {
            // If the API returned a plain string that isn't JSON and doesn't start with "error"
            showToast(apiResponse, 'error');
            return null;
        }

    } catch (ex) {
        showToast('BNI call failed: ' + ex.message, 'error');
        console.error(ex);
        return null;
    } finally {
        if (spinner) spinner.style.display = 'none';
    }
}