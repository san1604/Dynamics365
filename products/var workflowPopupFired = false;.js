var workflowPopupFired = false;
var lastStageSentToFlow = null;
var currentBpfStage = null;

function markAsComplete(primaryControl) {
    debugger;
    var formContext = primaryControl;
    currentBpfStage = getCurrentBpfStageName(formContext);
    console.log("Current Stage:", currentBpfStage);
    moveToNextStage(formContext, currentBpfStage);
    var quoteStatusAttr = formContext.getAttribute("sb1_quotestatus");
    if (!quoteStatusAttr) return;
    var quoteStatusValue = quoteStatusAttr.getValue();
    if (quoteStatusValue === 1) {
        quoteStatusAttr.setValue(2);
    }
    formContext.data.refresh(true);
}

function moveToNextStage(formContext, currentBpfStage) {

    if (!formContext.data.process) {
        console.log("BPF is not available on this form.");
        return;
    }

    // If already on Sold → finish BPF
    if (currentBpfStage === "Sold") {

        syncQuoteWorkflowConfiguration(formContext, currentBpfStage);
        finishBpf(formContext);
        formContext.getAttribute("sb1_quotestatus").setValue(4);
        return;
    }

    // Move to next stage
    formContext.data.save().then(
        function () {
            // Move to next stage
            formContext.data.process.moveNext(
                function (result) {

                    if (result === "success") {
                        console.log("Moved to next stage successfully.");
                        formContext.data.save().then(
                            function () {
                                // Call flow AFTER successful move
                                syncQuoteWorkflowConfiguration(formContext, currentBpfStage);
                            });
                    } else {
                        console.log("Move next result: " + result);
                    }
                },
                function (error) {
                    console.error("Move next failed: " + error.message);
                }
            );
        });
}

async function syncQuoteWorkflowConfiguration(formContext, currentBpfStage) {
    const quoteType = formContext.getAttribute("sb1_quotetype")?.getValue();
    if (quoteType === null || quoteType === undefined) return;
    // Get Workflow Config lookup
    const configLookup = formContext.getAttribute("sb1_quoteworkflowconfiguration").getValue();
    if (!configLookup || configLookup.length === 0) return;

    const configId = configLookup[0].id.replace("{", "").replace("}", "");

    Xrm.WebApi.retrieveRecord(
        "sb1_quoteworkflowconfiguration",
        configId,
        "?$select=" +
        "sb1_submitquoteforpricingpremiumfornew," +
        "sb1_triggerexceptionalapprovalfornew," +
        "sb1_quotestateifrejectedfornew," +
        "sb1_internalreviewfornew," +
        "sb1_submitquoteforpricingpremiumforrenew," +
        "sb1_triggerexceptionalapprovalforrenew," +
        "sb1_quotestateifrejectedforrenew," +
        "sb1_internalreviewforrenew," +
        "sb1_acceptedquotestatusfornew," +
        "sb1_acceptedquotestatusforrenew," +
        "sb1_approvedquotestatusfornew," +
        "sb1_approvedquotestatusforrenew," +
        "sb1_draftquotestatusfornew," +
        "sb1_draftquotestatusforrenew," +
        "sb1_inreviewquotestatusfornew," +
        "sb1_inreviewquotestatusforrenew," +
        "sb1_presentedquotestatusfornew," +
        "sb1_presentedsquotestatusforrenew"
    ).then(async function (config) {
        await applyQuoteWorkflowLogic(formContext, config, currentBpfStage);

    }).catch(function (error) {
        console.error("Error loading workflow config: ", error.message);
    });
}

async function applyQuoteWorkflowLogic(formContext, config, currentBpfStage) {

    const quoteType = formContext.getAttribute("sb1_quotetype").getValue();
    const folderVersionId = formContext.getAttribute("sb1_quoteid").getValue();
    const postStageChange = getCurrentBpfStageName(formContext);

    let submitStage = "";
    let exceptionalStage = "";
    let rejectedStage = "";
    let internalReviewStage = "";
    let draftStage = "";
    let inReviewStage = "";
    let approvedStage = "";
    let presentedStage = "";
    let acceptedStage = "";

    console.log("Current Stage:", currentBpfStage);

    if (quoteType == 0) { // NEW

        submitStage = config.sb1_submitquoteforpricingpremiumfornew;
        exceptionalStage = config.sb1_triggerexceptionalapprovalfornew;
        rejectedStage = config.sb1_quotestateifrejectedfornew;
        internalReviewStage = config.sb1_internalreviewfornew;

        // 🔽 Added from screenshot
        draftStage = config.sb1_draftquotestatusfornew;
        inReviewStage = config.sb1_inreviewquotestatusfornew;
        approvedStage = config.sb1_approvedquotestatusfornew;
        presentedStage = config.sb1_presentedquotestatusfornew;
        acceptedStage = config.sb1_acceptedquotestatusfornew;

    } else { // RENEW

        submitStage = config.sb1_submitquoteforpricingpremiumforrenew;
        exceptionalStage = config.sb1_triggerexceptionalapprovalforrenew;
        rejectedStage = config.sb1_quotestateifrejectedforrenew;
        internalReviewStage = config.sb1_internalreviewforrenew;

        // 🔽 Added from screenshot
        draftStage = config.sb1_draftquotestatusforrenew;
        inReviewStage = config.sb1_inreviewquotestatusforrenew;
        approvedStage = config.sb1_approvedquotestatusforrenew;
        presentedStage = config.sb1_presentedsquotestatusforrenew;
        acceptedStage = config.sb1_acceptedquotestatusforrenew;
    }


    console.log("Current Stage:", currentBpfStage);

    if (currentBpfStage == submitStage) {
        var apiResponse = await submitQuoteToUW(formContext);
        console.log("api Responce ..." + apiResponse);
        if (apiResponse !== "Success") return;
        setAllFieldsReadOnly(formContext);
    }

    if (currentBpfStage == exceptionalStage) {
        await triggerExceptionalApproval();
        setAllFieldsReadOnly(formContext);

    }

    if (currentBpfStage == internalReviewStage || currentBpfStage == "Sold") {
        setAllFieldsReadOnly(formContext);
    }

    if (postStageChange == internalReviewStage || postStageChange == exceptionalStage || postStageChange == submitStage) {
        setAllFieldsReadOnly(formContext);
    }
    console.log("Current Stage:", postStageChange);
    var workflowStageValue = "";

    switch (postStageChange) {
        case "Draft":
            workflowStageValue = draftStage;
            break;

        case "In Progress":
            workflowStageValue = inReviewStage;
            break;

        case "Premium Calculation":
            workflowStageValue = approvedStage;
            break;

        case "Review Premium":
            workflowStageValue = presentedStage;
            break;

        case "Sold":
            workflowStageValue = acceptedStage;
            break;


        default:
            return; // no call
    }
    console.log(workflowStageValue);
    formContext.data.save().then(
        async function () {
            await callSyncApiOnChangeStage(formContext, folderVersionId, quoteType, workflowStageValue);
        });

}


// async function callSyncApiOnChangeStage(formContext, folderVersionId, quoteType, workflowStageValue) {
//     Xrm.Utility.showProgressIndicator("Updating Stage...");
//     var request = {
//         sb1_folderversionid: folderVersionId,
//         sb1_quotetype: quoteType,
//         sb1_workflowstage: workflowStageValue,

//         getMetadata: function () {
//             return {
//                 boundParameter: null,
//                 parameterTypes: {
//                     "sb1_folderversionid": {
//                         typeName: "Edm.Int32",
//                         structuralProperty: 1 // PrimitiveType
//                     },
//                     "sb1_quotetype": {
//                         typeName: "Edm.Int32",
//                         structuralProperty: 1
//                     },
//                     "sb1_workflowstage": {
//                         typeName: "Edm.String",
//                         structuralProperty: 1
//                     }
//                 },
//                 operationType: 0, // Action
//                 operationName: "sb1_syncworkflowwithb1"
//             };
//         }
//     };

//     await Xrm.WebApi.online.execute(request)
//         .then(function (response) {
//             if (response.ok) {
//                 Xrm.Utility.closeProgressIndicator();
//                 Xrm.Navigation.openAlertDialog({
//                     title: "Success",
//                     text: "Quote stage changed successfully."
//                 });
//                 updateQuoteStage(formContext);
//             }
//             else {
//                 moveBPFToPreviousStage(formContext)
//                 Xrm.Utility.closeProgressIndicator();
//                 Xrm.Navigation.openAlertDialog({
//                     title: "Failed",
//                     text: "Quote stage change failed."
//                 });
//             }
//         })
//         .catch(function (error) {
//             moveBPFToPreviousStage(formContext)
//             Xrm.Utility.closeProgressIndicator();
//             Xrm.Navigation.openAlertDialog({
//                 title: "Failed",
//                 text: "Quote stage change failed."
//             });
//             console.error(error.message);
//         });
// }
async function callSyncApiOnChangeStage(formContext, folderVersionId, quoteType, workflowStageValue) {
    Xrm.Utility.showProgressIndicator("Updating Stage...");

    // 🔥 Normalize stage (VERY IMPORTANT)
    workflowStageValue = workflowStageValue
        ?.trim()
        ?.replace(/\u00A0/g, " ");

    console.log("FolderVersionId:", folderVersionId);
    console.log("QuoteType:", quoteType);
    console.log("WorkflowStage:", workflowStageValue);

    var request = {
        sb1_folderversionid: folderVersionId,
        sb1_quotetype: quoteType,
        sb1_workflowstage: workflowStageValue,

        getMetadata: function () {
            return {
                boundParameter: null,
                parameterTypes: {
                    "sb1_folderversionid": {
                        typeName: "Edm.Int32",
                        structuralProperty: 1
                    },
                    "sb1_quotetype": {
                        typeName: "Edm.Int32",
                        structuralProperty: 1
                    },
                    "sb1_workflowstage": {
                        typeName: "Edm.String",
                        structuralProperty: 1
                    }
                },
                operationType: 0,
                operationName: "sb1_syncworkflowwithb1"
            };
        }
    };

    try {
        let response = await Xrm.WebApi.online.execute(request);

        if (response.ok) {
            Xrm.Utility.closeProgressIndicator();

            // Optional: read response
            try {
                let data = await response.json();
                console.log("API Response:", data);
            } catch (e) {}

            Xrm.Navigation.openAlertDialog({
                title: "Success",
                text: "Quote stage changed successfully."
            });

            updateQuoteStage(formContext);
        } else {
            throw new Error("API failed");
        }
    } catch (error) {
        moveBPFToPreviousStage(formContext);

        Xrm.Utility.closeProgressIndicator();

        Xrm.Navigation.openAlertDialog({
            title: "Failed",
            text: "Quote stage change failed."
        });

        console.error("Error:", error.message);
    }
}

async function submitQuoteToUW(formContext) {
    try {
        var quoteId = formContext.data.entity.getId();
        if (!quoteId) {
            await Xrm.Navigation.openAlertDialog({ text: "Quote Id not found." });
            return "Failed";
        }
        quoteId = quoteId.replace(/[{}]/g, "");
        var folderVersionAttr = formContext.getAttribute("sb1_quoteid");
        if (!folderVersionAttr || folderVersionAttr.getValue() === null) {
            await Xrm.Navigation.openAlertDialog({ text: "Folder Version Id not found." });
            return "Failed";
        }

        var folderVersionId = folderVersionAttr.getValue();

        var request = {
            sb1_folderversion_id: folderVersionId,
            sb1_quote_guid: quoteId,

            getMetadata: function () {
                return {
                    boundParameter: null,
                    parameterTypes: {
                        sb1_folderversion_id: {
                            typeName: "Edm.Int32",
                            structuralProperty: 1
                        },
                        sb1_quote_guid: {
                            typeName: "Edm.String",
                            structuralProperty: 1
                        }
                    },
                    operationName: "sb1_submit_quote_uw",
                    operationType: 0
                };
            }
        };

        Xrm.Utility.showProgressIndicator("Submitting Quote to Underwriter...");

        const response = await Xrm.WebApi.online.execute(request);
        Xrm.Utility.closeProgressIndicator();
        if (!response.ok) {
            throw new Error("Custom API execution failed.");
        }
        const uwResponseRaw = await response.json();
        var rawUwResponse = uwResponseRaw.sb1_uw_responce;

        if (!rawUwResponse) {
            throw new Error("UW response not returned from Custom API.");
        }

        let uwResponse;
        try {
            uwResponse = JSON.parse(rawUwResponse);
        } catch (e) {
            uwResponse = {
                Success: false,
                Message: rawUwResponse
            };
        }
        if (
            uwResponse.Result &&
            uwResponse.Result.Success &&
            uwResponse.Result.Success.toLowerCase() === "success"
        ) {
            Xrm.Navigation.openAlertDialog({
                title: "Submit Quote",
                text: uwResponse.Result.Message || "Quote submitted successfully."
            });
            return "Success";
        }
        else {
            var errorMsg =
                (uwResponse.Errors && uwResponse.Errors.length
                    ? uwResponse.Errors.join(", ")
                    : uwResponse.Result?.Message) ||
                "UW submission failed.";

            Xrm.Navigation.openAlertDialog({
                title: "UW Error",
                text: errorMsg
            });

            await moveBPFToPreviousStage(formContext);
            return "Failed";
        }
    } catch (error) {
        Xrm.Utility.closeProgressIndicator();
        console.error(error);
        await Xrm.Navigation.openAlertDialog({
            title: "Error",
            text: error.message || "Unexpected error while submitting quote."
        });
        return "Failed";
    }
}

async function moveBPFToPreviousStage(formContext) {
    var currentStage = formContext.data.process.getActiveStage();
    if (!currentStage) return;
    var currentStageName = currentStage.getName();
    var previousStageName = null;

    // Manual stage order mapping
    switch (currentStageName) {
        case "In Progress":
            previousStageName = "Draft";
            break;

        case "Premium Calculation":
            previousStageName = "In Progress";
            break;

        case "Review Premium":
            previousStageName = "Premium Calculation";
            break;

        case "Sold":
            previousStageName = "Review Premium";
            break;

        default:
            console.log("Already at first stage or unknown stage.");
            return;
    }

    var processId = formContext.data.process.getInstanceId();

    if (!processId) {
        console.log("Process instance not found.");
        return;
    }

    // Get Stage ID
    Xrm.WebApi.retrieveMultipleRecords(
        "processstage",
        "?$select=processstageid&$filter=stagename eq '" + previousStageName + "'"
    ).then(function (result) {

        if (result.entities.length === 0) {
            throw new Error("Previous stage not found.");
        }

        var previousStageId = result.entities[0].processstageid;

        return Xrm.WebApi.updateRecord(
            "sb1_quotequoteprocessflow",
            processId,
            {
                "activestageid@odata.bind":
                    "/processstages(" + previousStageId + ")"
            }
        );

    }).then(function () {
        formContext.data.save();
        console.log("Successfully moved back to:", previousStageName);

    }).catch(function (error) {
        console.error("Failed to move back:", error.message);
        // formContext.data.refresh(false);
    });
}

function setFieldsEditable(formContext) {
    formContext.ui.controls.forEach(function (ctrl) {
        try {
            ctrl.setDisabled(false); // enable field
        } catch (e) { }
    });
    formContext.getAttribute("sb1_quoteedit").setValue(1);
}

function setAllFieldsReadOnly(formContext) {
    formContext.ui.controls.forEach(function (ctrl) {
        try { ctrl.setDisabled(true); } catch { }
    });
    formContext.getAttribute("sb1_quoteedit").setValue(2);

}

function triggerExceptionalApproval() {
    Xrm.Navigation.openAlertDialog({
        text: "Exceptional Approval triggered.",
        title: "Exceptional Approval"
    });
}

function getCurrentBpfStageName(formContext) {
    try {
        let activeStage = formContext.data.process.getActiveStage();
        console.log("called  active stage" + activeStage);
        return activeStage ? activeStage.getName() : "";
    } catch (e) {
        return "";
    }
}

function updateQuoteStage(formContext) {
    var quoteStage = formContext.getAttribute("sb1_quotestage").getValue();
    if (quoteStage == 918580004) return;
    quoteStage = quoteStage + 1;
    formContext.getAttribute("sb1_quotestage").setValue(quoteStage);
}

function finishBpf(formContext) {
    if (!formContext.data.process) return;
    formContext.data.process.setStatus("finished",
        function () {
            formContext.data.save();
        },
        function (error) {
            console.error("Failed to finish BPF:", error.message);
        }
    );
}
function HideSetActiveButton(executionContext) {
    var formContext = executionContext.getFormContext();
    formContext.data.process.addOnStageSelected(onStageClicked);
}

function onStageClicked() {
    var hide = true;
    var interval = null;
    interval = setInterval(function () {
        var element = parent.document.getElementById("MscrmControls.Containers.ProcessStageControl-businessProcessFlowFlyoutFooterContainer");
        if (element != null && hide == true) {
            hide = false;
            element.style.display = "none";
            clearInterval(interval);
        }
    }, 10);
}

// Reject Quote 
async function markAsReject(primaryControl) {
    debugger;

    const formContext = primaryControl;
    const quoteStatus = formContext.getAttribute("sb1_quotestatus");
    quoteStatus.setValue(3);
    quoteStatus.fireOnChange();

}

// async function onQuoteStatusReject(executionContext) {
//     console.log("onQuoteStatusReject triggered");
//     debugger;

//     if (quoteStatus === toLowerCase("Rejected")) {
//         const formContext = executionContext.getFormContext();
//         const folderVersionId = formContext.getAttribute("sb1_quoteid").getValue();
//         const recordId = formContext.data.entity.getId().replace(/[{}]/g, "");
//         console.log("Before try")
//         try {

//             Xrm.Utility.showProgressIndicator("Rejecting Quote...");

//             // Step 1: Call API
//             await callRejectQuoteCustomApi(formContext, folderVersionId, recordId);

//             // Step 2: Change stage
//             await rejectQuoteChangeStage(formContext, recordId);

//             // Step 3: Save + Refresh
//             await formContext.data.save();
//             await formContext.data.refresh(true);

//             const quoteStatus = formContext.getAttribute("sb1_quotestatus");
//             quoteStatus.setValue(2);
//             await Xrm.Navigation.openAlertDialog({
//                 title: "Success",
//                 text: "Quote rejected successfully."
//             });

//         } catch (error) {

//             Xrm.Navigation.openAlertDialog({
//                 title: "Failed",
//                 text: error.message
//             });

//         } finally {
//             await Xrm.Utility.closeProgressIndicator();
//         }
//     }
//     else {
//         return
//     }

// }
async function onQuoteStatusReject(executionContext) {
    const formContext = executionContext.getFormContext();
    
    // 1. Get the attribute first
    const quoteStatusAttr = formContext.getAttribute("sb1_quotestatus"); 
    
    // 2. Get the value (assuming it's a Text field based on your toLowerCase check)
    const quoteStatusValue = quoteStatusAttr ? quoteStatusAttr.getValue() : "";

    // 3. Perform the check (Fixed: comparison with defined variable)
    if (quoteStatusValue === 3) {
        const folderVersionId = formContext.getAttribute("sb1_quoteid").getValue();
        const recordId = formContext.data.entity.getId().replace(/[{}]/g, "");

        try {
            Xrm.Utility.showProgressIndicator("Rejecting Quote...");

            await callRejectQuoteCustomApi(formContext, folderVersionId, recordId);
            await rejectQuoteChangeStage(formContext, recordId);

            // Update status value (Note: 2 is usually an OptionSet integer)
            quoteStatusAttr.setValue(2); 

            await formContext.data.save();
            await formContext.data.refresh(true);

            await Xrm.Navigation.openAlertDialog({
                title: "Success",
                text: "Quote rejected successfully."
            });
        } catch (error) {
            Xrm.Navigation.openAlertDialog({ title: "Failed", text: error.message });
        } finally {
            Xrm.Utility.closeProgressIndicator();
        }
    }
}

async function callRejectQuoteCustomApi(formContext, folderVersionId, recordId) {

    if (!folderVersionId || !recordId) {
        throw new Error("Folder Version Id or Quote Id is missing.");
    }

    const request = {
        sb1_folderversion_id_reject: folderVersionId,
        sb1_guid: recordId,
        getMetadata: function () {
            return {
                boundParameter: null,
                parameterTypes: {
                    "sb1_folderversion_id_reject": {
                        typeName: "Edm.Int32",
                        structuralProperty: 1
                    },
                    "sb1_guid": {
                        typeName: "Edm.String",
                        structuralProperty: 1
                    }
                },
                operationType: 0,
                operationName: "sb1_reject_quote_sync_with_b1"
            };
        }
    };

    const response = await Xrm.WebApi.online.execute(request);

    if (!response.ok) {
        throw new Error("Quote rejection failed from API.");
    }

    const result = await response.json();

    const updatedQuoteId = result.sb1_updated_quote_id;

    if (updatedQuoteId) {
        formContext.getAttribute("sb1_quoteid").setValue(updatedQuoteId);
    }

    return true;
}

async function rejectQuoteChangeStage(formContext, recordId) {

    if (!recordId) {
        throw new Error("Quote Id not found.");
    }

    const quote = await Xrm.WebApi.retrieveRecord(
        "quote",
        recordId,
        "?$select=sb1_quotetype,_sb1_quoteworkflowconfiguration_value"
    );

    const configId = quote._sb1_quoteworkflowconfiguration_value;

    if (!configId)
        throw new Error("Quote Workflow Configuration is missing.");

    const config = await Xrm.WebApi.retrieveRecord(
        "sb1_quoteworkflowconfiguration",
        configId,
        "?$select=sb1_quotestateifrejectedfornew,sb1_quotestateifrejectedforrenew"
    );

    const isRenew = quote.sb1_quotetype === 1;

    const rejectedStageName = isRenew
        ? config.sb1_quotestateifrejectedforrenew
        : config.sb1_quotestateifrejectedfornew;

    if (!rejectedStageName)
        throw new Error("Rejected stage is not configured.");

    const bpfResult = await Xrm.WebApi.retrieveMultipleRecords(
        "sb1_quotequoteprocessflow",
        `?$select=businessprocessflowinstanceid&$filter=_bpf_quoteid_value eq ${recordId}`
    );

    if (!bpfResult.entities.length)
        throw new Error("BPF instance not found.");

    const bpfId = bpfResult.entities[0].businessprocessflowinstanceid;

    const stageResult = await Xrm.WebApi.retrieveMultipleRecords(
        "processstage",
        `?$select=processstageid&$filter=stagename eq '${rejectedStageName}'`
    );

    if (!stageResult.entities.length)
        throw new Error("Rejected BPF stage not found.");

    const stageId = stageResult.entities[0].processstageid;

    await Xrm.WebApi.updateRecord(
        "sb1_quotequoteprocessflow",
        bpfId,
        {
            "activestageid@odata.bind": `/processstages(${stageId})`
        }
    );

    setFieldsEditable(formContext);

    formContext.getAttribute("sb1_quotestatus").setValue(1);
    formContext.getAttribute("sb1_quoteedit").setValue(1);
    formContext.getAttribute("sb1_quotestage").setValue(918580000);
}

function syncQuoteWorkflowConfigurationOnload(executionContext) {
    var formContext = executionContext.getFormContext();
    var formType = formContext.ui.getFormType();
    if (formType == 1) return;
    var quoteEdit = formContext.getAttribute("sb1_quoteedit").getValue();
    if (quoteEdit == 2) {
        setAllFieldsReadOnly(formContext);
        formContext.data.refresh(true);
    }
}
