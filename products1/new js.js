var SB1 = SB1 || {};
SB1.Opportunity = (function () {
    "use strict";

    /*
function copyQuote(primaryControl) {

    var selectedRow;

    try {

        // 🔹 Detect form vs grid
        if (primaryControl.getEntity) {
            var formContext = primaryControl;
            var subgrid = formContext.getControl("Quotes");

            if (!subgrid || !subgrid.getGrid) {
                Xrm.Navigation.openAlertDialog({ text: "Quotes subgrid not found." });
                return;
            }

            var selectedRows = subgrid.getGrid().getSelectedRows();

            if (selectedRows.getLength() === 0) {
                Xrm.Navigation.openAlertDialog({ text: "Select a quote to renew." });
                return;
            }

            selectedRow = selectedRows.getAll()[0];

        } else {

            var selectedRows = primaryControl.getGrid().getSelectedRows();

            if (selectedRows.getLength() === 0) {
                Xrm.Navigation.openAlertDialog({ text: "Select a quote to renew." });
                return;
            }

            selectedRow = selectedRows.getAll()[0];
        }

        // 🔹 Get Quote ID
        var quoteId = selectedRow.getData().getEntity().getId().replace(/[{}]/g, "");

        // 🔹 Retrieve Quote
        Xrm.WebApi.retrieveRecord(
            "quote",
            quoteId,
            "?$select=name,ownerid,opportunityid,effectivefrom," +
            "sb1_lineofbusiness,sb1_marketsegment,sb1_fundingarrangement,sb1_state,sb1_region"
        ).then(function (quote) {

            var formParameters = {
                name: quote.name,
                sb1_quotetype: 2, // Renewal
                effectivefrom: quote.effectivefrom,

                // 🔹 Copied fields
                sb1_lineofbusiness: quote.sb1_lineofbusiness,
                sb1_marketsegment: quote.sb1_marketsegment,
                sb1_fundingarrangement: quote.sb1_fundingarrangement,
                sb1_state: quote.sb1_state,
                sb1_region: quote.sb1_region,

                // 🔹 Source effective date
                sb1_sourceeffectivedate: quote.effectivefrom
            };

            // ✅ 🔹 Set Source Quote lookup (THIS IS THE NEW PART)
            formParameters.sb1_sourcequote = quoteId;
            formParameters.sb1_sourcequotename = quote.name;
            formParameters.sb1_sourcequotetype = "quote";

            // 🔹 Owner
            if (quote.ownerid) {
                formParameters.ownerid = quote.ownerid.id;
                formParameters.owneridname = quote.ownerid.name;
                formParameters.owneridtype = quote.ownerid.entityType;
            }

            // 🔹 Opportunity
            if (quote.opportunityid) {
                formParameters.opportunityid = quote.opportunityid.id;
                formParameters.opportunityidname = quote.opportunityid.name;
                formParameters.opportunityidtype = quote.opportunityid.entityType;
            }

            var entityFormOptions = {
                entityName: "quote",
                useQuickCreateForm: false
            };

            // 🔹 Open new Quote form
            Xrm.Navigation.openForm(entityFormOptions, formParameters);

        }).catch(function (e) {
            console.error("Error retrieving quote: " + e.message);
        });

    } catch (ex) {
        console.error("Unexpected error: " + ex.message);
    }
}
*/
    
 function copyQuote(primaryControl) {

    var selectedRow;

    try {

        // 🔹 Detect form vs grid
        if (primaryControl.getEntity) {
            var formContext = primaryControl;
            var subgrid = formContext.getControl("Quotes");

            if (!subgrid || !subgrid.getGrid) {
                Xrm.Navigation.openAlertDialog({ text: "Quotes subgrid not found." });
                return;
            }

            var selectedRows = subgrid.getGrid().getSelectedRows();

            if (selectedRows.getLength() === 0) {
                Xrm.Navigation.openAlertDialog({ text: "Select a quote to renew." });
                return;
            }

            selectedRow = selectedRows.getAll()[0];

        } else {

            var selectedRows = primaryControl.getGrid().getSelectedRows();

            if (selectedRows.getLength() === 0) {
                Xrm.Navigation.openAlertDialog({ text: "Select a quote to renew." });
                return;
            }

            selectedRow = selectedRows.getAll()[0];
        }

        // 🔹 Get Quote ID
        var quoteId = selectedRow.getData().getEntity().getId().replace(/[{}]/g, "");

        // 🔹 Retrieve Quote
        Xrm.WebApi.retrieveRecord(
            "quote",
            quoteId,
            "?$select=name,ownerid,_opportunityid_value,effectivefrom," +
            "sb1_lineofbusiness,sb1_marketsegment,sb1_fundingarrangement,sb1_state,sb1_region," +
            "_transactioncurrencyid_value,_pricelevelid_value," +
            "sb1_numberofsubscribers,sb1_numberofmembers,sb1_minage,sb1_maxage,sb1_averageage," +
            "totallineitemamount,discountpercentage,discountamount,totaltax,totalamount," +
            "description,_customerid_value,_sb1_broker_value,sb1_brokerid"
        ).then(function (quote) {

            var formParameters = {
                name: quote.name,
                sb1_quotetype: 2, // Copy Quote
                effectivefrom: quote.effectivefrom,

                // 🔹 Existing copied fields
                sb1_lineofbusiness: quote.sb1_lineofbusiness,
                sb1_marketsegment: quote.sb1_marketsegment,
                sb1_fundingarrangement: quote.sb1_fundingarrangement,
                sb1_state: quote.sb1_state,
                sb1_region: quote.sb1_region,

                // 🔹 Source effective date
                sb1_sourceeffectivedate: quote.effectivefrom,

                // 🔹 NEW simple fields
                sb1_numberofsubscribers: quote.sb1_numberofsubscribers,
                sb1_numberofmembers: quote.sb1_numberofmembers,
                sb1_minage: quote.sb1_minage,
                sb1_maxage: quote.sb1_maxage,
                sb1_averageage: quote.sb1_averageage,
                totallineitemamount: quote.totallineitemamount,
                discountpercentage: quote.discountpercentage,
                discountamount: quote.discountamount,
                totaltax: quote.totaltax,
                totalamount: quote.totalamount,
                description: quote.description
            };

            // 🔹 Source Quote lookup
            formParameters.sb1_sourcequote = quoteId;
            formParameters.sb1_sourcequotename = quote.name;
            formParameters.sb1_sourcequotetype = "quote";

            // 🔹 Owner
            if (quote.ownerid) {
                formParameters.ownerid = quote.ownerid.id;
                formParameters.owneridname = quote.ownerid.name;
                formParameters.owneridtype = quote.ownerid.entityType;
            }

            // 🔹 Opportunity
            if (quote._opportunityid_value) {
                formParameters.opportunityid = quote._opportunityid_value;
                formParameters.opportunityidname = quote["_opportunityid_value@OData.Community.Display.V1.FormattedValue"];
                formParameters.opportunityidtype = quote["_opportunityid_value@Microsoft.Dynamics.CRM.lookuplogicalname"];
            }

            // 🔹 Transaction Currency
            if (quote._transactioncurrencyid_value) {
                formParameters.transactioncurrencyid = quote._transactioncurrencyid_value;
                formParameters.transactioncurrencyidname = quote["_transactioncurrencyid_value@OData.Community.Display.V1.FormattedValue"];
                formParameters.transactioncurrencyidtype = "transactioncurrency";
            }

            // 🔹 Price List
            if (quote._pricelevelid_value) {
                formParameters.pricelevelid = quote._pricelevelid_value;
                formParameters.pricelevelidname = quote["_pricelevelid_value@OData.Community.Display.V1.FormattedValue"];
                formParameters.pricelevelidtype = "pricelevel";
            }

            // 🔹 Customer
            if (quote._customerid_value) {
                formParameters.customerid = quote._customerid_value;
                formParameters.customeridname = quote["_customerid_value@OData.Community.Display.V1.FormattedValue"];
                formParameters.customeridtype = quote["_customerid_value@Microsoft.Dynamics.CRM.lookuplogicalname"];
            }

            // 🔹 Broker lookup
            if (quote._sb1_broker_value) {
                formParameters.sb1_broker = quote._sb1_broker_value;
                formParameters.sb1_brokername = quote["_sb1_broker_value@OData.Community.Display.V1.FormattedValue"];
                formParameters.sb1_brokertype = quote["_sb1_broker_value@Microsoft.Dynamics.CRM.lookuplogicalname"];
            }

            // 🔹 Broker ID copied directly from source quote
            if (quote.sb1_brokerid) {
                formParameters.sb1_brokerid = quote.sb1_brokerid;
            }

            var entityFormOptions = {
                entityName: "quote",
                useQuickCreateForm: false
            };

            // 🔹 Open new Quote form
            Xrm.Navigation.openForm(entityFormOptions, formParameters);

        }).catch(function (e) {
            console.error("Error retrieving quote: " + e.message);
        });

    } catch (ex) {
        console.error("Unexpected error: " + ex.message);
    }
}
 

function copyQuoteFromSubgrid(primaryControl) {
    debugger;

    const subgridName = "quote"; // Your subgrid name
    const formContext = primaryControl;
    const subgridControl = formContext.getControl(subgridName);

    // Set Quote Type on current form (if needed)
    var quoteTypeControl = formContext.getControl("sb1_quotetype");
    if (quoteTypeControl) {
        quoteTypeControl.getAttribute().setValue(2);
    }

    if (!subgridControl) {
        Xrm.Navigation.openAlertDialog({ text: "Quote subgrid not found on the form." });
        return;
    }

    if (!subgridControl.getGrid || !subgridControl.getGrid().getSelectedRows) {
        Xrm.Navigation.openAlertDialog({ text: "Quote subgrid is not fully loaded yet. Please try again." });
        return;
    }

    const selectedRows = subgridControl.getGrid().getSelectedRows();

    if (selectedRows.getLength() === 0) {
        Xrm.Navigation.openAlertDialog({ text: "Please select a quote to renew." });
        return;
    }

    const selectedRow = selectedRows.getAll()[0];
    const quoteId = selectedRow.getData().getEntity().getId().replace("{", "").replace("}", "");

    var formParameters = {};

    // Retrieve selected quote
    Xrm.WebApi.retrieveRecord(
        "quote",
        quoteId,
        "?$select=ownerid,name," +
        "billto_line1,billto_line2,billto_city,sb1_billtostate,billto_postalcode,sb1_billtocountry," +
        "totallineitemamount,discountpercentage,discountamount,totaltax,totalamount," +
        "opportunityid,sb1_quotename,statecode,sb1_numberofsubscribers,sb1_numberofmembers," +
        "sb1_minage,sb1_maxage,sb1_averageage,effectivefrom"
    ).then(function (result) {

        // Map fields to new quote
        Object.assign(formParameters, {
            name: result.name,
            billto_line1: result.billto_line1,
            billto_line2: result.billto_line2,
            billto_city: result.billto_city,
            sb1_billtostate: result.sb1_billtostate,
            billto_postalcode: result.billto_postalcode,
            sb1_billtocountry: result.sb1_billtocountry,
            totallineitemamount: result.totallineitemamount,
            discountpercentage: result.discountpercentage,
            discountamount: result.discountamount,
            totaltax: result.totaltax,
            totalamount: result.totalamount,
            sb1_quotename: result.sb1_quotename,
            statecode: result.statecode,
            sb1_numberofsubscribers: result.sb1_numberofsubscribers,
            sb1_numberofmembers: result.sb1_numberofmembers,
            sb1_minage: result.sb1_minage,
            sb1_maxage: result.sb1_maxage,
            sb1_averageage: result.sb1_averageage,
            sb1_quotetype: 2,
            effectivefrom: result.effectivefrom,
            sb1_sourceeffectivedate: result.effectivefrom
        });

        // 🔹 Set Source Quote lookup (IMPORTANT PART)
        formParameters["sb1_sourcequote"] = quoteId;
        formParameters["sb1_sourcequotename"] = result.name;
        formParameters["sb1_sourcequotetype"] = "quote";

        // 🔹 Handle Owner lookup
        if (result._ownerid_value) {
            formParameters["ownerid"] = result._ownerid_value;
            formParameters["owneridname"] = result["_ownerid_value@OData.Community.Display.V1.FormattedValue"];
            formParameters["owneridtype"] = result["_ownerid_value@Microsoft.Dynamics.CRM.lookuplogicalname"];
        }

        // 🔹 Handle Opportunity lookup
        if (result._opportunityid_value) {
            formParameters["opportunityid"] = result._opportunityid_value;
            formParameters["opportunityidname"] = result["_opportunityid_value@OData.Community.Display.V1.FormattedValue"];
            formParameters["opportunityidtype"] = result["_opportunityid_value@Microsoft.Dynamics.CRM.lookuplogicalname"];
        }

        // Open new Quote form
        var entityFormOptions = {
            entityName: "quote",
            useQuickCreateForm: false
        };

        Xrm.Navigation.openForm(entityFormOptions, formParameters).then(
            function () {
                console.log("New quote form opened successfully.");
            },
            function (error) {
                console.error("Error opening form: ", error.message);
            }
        );

    }).catch(function (error) {
        console.error("Error retrieving quote: ", error.message);
        Xrm.Navigation.openAlertDialog({ text: "Error retrieving selected quote." });
    });
}


    function renewQuoteForSubgrid(primaryControl) {
        debugger;

        const subgridName = "quote"; // 
        const formContext = primaryControl;
        const subgridControl = formContext.getControl(subgridName);


        // Get the attribute for your choice field (replace 'your_choice_field_name' with the actual schema name)
        var choiceAttribute = formContext.getControl("sb1_quotetype");
        if (choiceAttribute) {
            choiceAttribute.setValue(1);
        }

        if (!subgridControl) {
            Xrm.Navigation.openAlertDialog({ text: "Quote subgrid not found on the form." });
            return;
        }

        if (!subgridControl.getGrid || !subgridControl.getGrid().getSelectedRows) {
            Xrm.Navigation.openAlertDialog({ text: "Quote subgrid is not fully loaded yet. Please try again." });
            return;
        }

        const selectedRows = subgridControl.getGrid().getSelectedRows();
        if (selectedRows.getLength() === 0) {
            Xrm.Navigation.openAlertDialog({ text: "Please select a quote to renew." });
            return;
        }

        const selectedRow = selectedRows.getAll()[0];
        const quoteId = selectedRow.getData().getEntity().getId().replace("{", "").replace("}", "");

        Xrm.WebApi.retrieveRecord("quote", quoteId, "?$select=_customerid_value,effectivefrom,statecode,statuscode,effectiveto,description,_pricelevelid_value,sb1_lineofbusiness,sb1_foldermode,sb1_marketsegment,sb1_region,sb1_brokerid,_sb1_broker_value,name,billto_line1,billto_line2,billto_city,sb1_billtostate,billto_postalcode,sb1_billtocountry,totallineitemamount,discountpercentage,discountamount,totaltax,totalamount,_opportunityid_value,sb1_quotename,statecode,sb1_numberofsubscribers,sb1_numberofmembers,sb1_minage,sb1_maxage,sb1_averageage,sb1_lineofbusiness,sb1_marketsegment,sb1_fundingarrangement,sb1_state,sb1_region").then(
            function (result) {



                var formParameters = {
                    name: result.name,
                    billto_line1: result.billto_line1,
                    billto_line2: result.billto_line2,
                    billto_city: result.billto_city,
                    sb1_quotetype: 1,
                    sb1_billtostate: result.sb1_billtostate,
                    billto_postalcode: result.billto_postalcode,
                    sb1_billtocountry: result.sb1_billtocountry,
                    totallineitemamount: result.totallineitemamount,
                    discountpercentage: result.discountpercentage,
                    discountamount: result.discountamount,
                    totaltax: result.totaltax,
                    totalamount: result.totalamount,
                    sb1_quotename: result.sb1_quotename,
                    statecode: result.statecode,
                    sb1_numberofsubscribers: result.sb1_numberofsubscribers,
                    sb1_numberofmembers: result.sb1_numberofmembers,
                    sb1_minage: result.sb1_minage,
                    sb1_maxage: result.sb1_maxage,
                    sb1_averageage: result.sb1_averageage,
                    sb1_region: result.sb1_region,
                    sb1_marketsegment: result.sb1_marketsegment,
                    sb1_foldermode: result.sb1_foldermode,
                    sb1_lineofbusiness: result.sb1_lineofbusiness,
                    sb1_brokerid: result.sb1_brokerid,
                    description: result.description,
                    effectivefrom: result.effectivefrom,
                    statecode: result.statecode,
                    statuscode: result.statuscode,
                    effectiveto: result.effectiveto,
                    sb1_lineofbusiness: result.sb1_lineofbusiness,
                    sb1_marketsegment: result.sb1_marketsegment,
                    sb1_fundingarrangement: result.sb1_fundingarrangement,
                    sb1_state: result.sb1_state,
                    sb1_region: result.sb1_region
                };

                if (result._customerid_value) {
                    formParameters["customerid"] = result._customerid_value;
                    formParameters["customeridname"] = result["_customerid_value@OData.Community.Display.V1.FormattedValue"];
                    formParameters["customeridtype"] = result["_customerid_value@Microsoft.Dynamics.CRM.lookuplogicalname"];
                }

                //  Opportunity lookup
                if (result._opportunityid_value) {
                    formParameters["opportunityid"] = result._opportunityid_value;
                    formParameters["opportunityidname"] = result["_opportunityid_value@OData.Community.Display.V1.FormattedValue"];
                    formParameters["opportunityidtype"] = result["_opportunityid_value@Microsoft.Dynamics.CRM.lookuplogicalname"];
                }
                if (result._sb1_broker_value) {
                    formParameters["sb1_broker"] = result._sb1_broker_value;
                    formParameters["sb1_brokername"] = result["_sb1_broker_value@OData.Community.Display.V1.FormattedValue"];
                    formParameters["sb1_brokertype"] = result["_sb1_broker_value@Microsoft.Dynamics.CRM.lookuplogicalname"];
                }
                if (result._pricelevelid_value) {
                    formParameters["pricelevelid"] = result._pricelevelid_value;
                    formParameters["pricelevelidname"] = result["_pricelevelid_value@OData.Community.Display.V1.FormattedValue"];
                    formParameters["pricelevelidtype"] = result["_pricelevelid_valuee@Microsoft.Dynamics.CRM.lookuplogicalname"];
                }


                var entityFormOptions = {
                    entityName: "quote",
                    useQuickCreateForm: false
                };

                console.log("Opening new quote form with params:", formParameters);

                Xrm.Navigation.openForm(entityFormOptions, formParameters).then(
                    function (success) {
                        console.log(" Renew Quote form opened successfully!", success);
                        setTimeout(function () {
                            var formContext = Xrm.Page;
                            if (!formContext) return;

                            var choiceAttr = formContext.getAttribute("sb1_quotetype");
                            if (choiceAttr) {
                                console.log("🟢 QuoteType value found:", choiceAttr.getValue());

                                if (choiceAttr.getValue() === 1) {
                                    console.log("🔹 Running restrictPastDates() because QuoteType = 1");
                                    restrictPastDates({ getFormContext: () => formContext });
                                } else if (choiceAttr.getValue() === 2) {
                                    console.log("🔹 Running validateEffectiveFormDate() because QuoteType = 2");
                                    validateEffectiveFormDate({ getFormContext: () => formContext });
                                }
                            }
                        }, 2500);
                    },
                    function (error) {
                        console.error("❌ Error opening Quote form:", error.message);
                    }
                );
            },
            function (error) {
                console.error("❌ Error retrieving Quote record:", error.message);
            }
        );
    }


    var baseEffectiveDateGlobal = null;

    function onFormLoad(executionContext) {
        var formContext = executionContext.getFormContext();
        var choiceAttribute = formContext.getAttribute("sb1_quotetype");

        // ✅ Run only for Renew Quote (assuming OptionSet value 1 = Renew)
        if (!choiceAttribute || choiceAttribute.getValue() !== 1) {
            return;
        }

        var dateAttr = formContext.getAttribute("effectivefrom");
        if (dateAttr && dateAttr.getValue()) {
            var originalDate = dateAttr.getValue();
            // Normalize and store globally
            baseEffectiveDateGlobal = new Date(originalDate.getFullYear(), originalDate.getMonth(), originalDate.getDate());
            console.log("Base Effective Date captured:", baseEffectiveDateGlobal);
        }
    }

    function restrictPastDates(executionContext) {
        var formContext = executionContext.getFormContext();
        var dateAttr = formContext.getAttribute("effectivefrom");

        if (!dateAttr || !baseEffectiveDateGlobal) return;

        var selectedDate = dateAttr.getValue();
        if (!selectedDate) {
            formContext.ui.clearFormNotification("EffectiveFromDateError");
            return;
        }

        selectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());

        // ✅ Compare selected date < original base effective date
        if (selectedDate.getTime() < baseEffectiveDateGlobal.getTime()) {
            formContext.ui.setFormNotification(
                "Effective date earlier than the original quote effective date is not allowed.",
                "ERROR",
                "EffectiveFromDateError"
            );
            dateAttr.setValue(baseEffectiveDateGlobal); // reset back
        } else {
            formContext.ui.clearFormNotification("EffectiveFromDateError");
        }
    }

    function validateEffectiveFromDate(executionContext) {
        var formContext = executionContext.getFormContext();

        var dateAttr = formContext.getAttribute("effectivefrom");
        var choiceAttribute = formContext.getAttribute("sb1_quotetype");
        var sourceDateAttr = formContext.getAttribute("sb1_sourceeffectivedate");

        // Only run validation if quote type = 2
        if (!choiceAttribute || choiceAttribute.getValue() !== 2) {
            return;
        }

        // Clear previous notification
        formContext.ui.clearFormNotification("EffectiveFromDateError");

        if (!dateAttr || !sourceDateAttr) return;

        var selectedDate = dateAttr.getValue();
        var sourceDate = sourceDateAttr.getValue();

        if (!selectedDate || !sourceDate) return;

        // Normalize dates (remove time)
        selectedDate.setHours(0, 0, 0, 0);
        sourceDate.setHours(0, 0, 0, 0);

        // Calculate minimum allowed date: 1st Jan of the previous year of source date
        var minAllowedDate = new Date(sourceDate.getFullYear() - 1, 0, 1);

        // Validate Effective From date
        if (selectedDate < minAllowedDate) {
            // Clear invalid date
            //dateAttr.setValue(null);

            // Show error notification
            formContext.ui.setFormNotification(
                "Effective From date must be on or after January 1st of the previous year (" +
                minAllowedDate.toLocaleDateString() +
                ").",
                "ERROR",
                "EffectiveFromDateError"
            );

            // Prevent form save
            if (executionContext.getEventArgs) {
                var eventArgs = executionContext.getEventArgs();
                if (eventArgs && eventArgs.preventDefault) {
                    eventArgs.preventDefault();
                }
            }
        }
    }



    // 🔹 Function 3: Renew Quote (Main Function)
    function renewQuote(primaryControl) {
        debugger;
        console.log("Primary Control:", primaryControl);

        if (!primaryControl.getGrid) {
            console.error("❌ Not a grid context.");
            return;
        }

        var grid = primaryControl.getGrid();
        var selectedRows = grid.getSelectedRows();

        if (selectedRows.getLength() === 0) {
            Xrm.Navigation.openAlertDialog({ text: "Please select a quote to renew." });
            return;
        }

        var selectedRow = selectedRows.getAll()[0];
        var quoteId = selectedRow.getData().getEntity().getId().replace("{", "").replace("}", "");
        console.log("Quote ID:", quoteId);

        // Retrieve existing quote record
        Xrm.WebApi.retrieveRecord(
            "quote",
            quoteId,
            "?$select=_customerid_value,effectivefrom,effectiveto,description,_pricelevelid_value,sb1_lineofbusiness,sb1_foldermode,sb1_marketsegment,sb1_region,sb1_brokerid,_sb1_broker_value,name,billto_line1,billto_line2,billto_city,sb1_billtostate,billto_postalcode,sb1_billtocountry,totallineitemamount,discountpercentage,discountamount,totaltax,totalamount,_opportunityid_value,sb1_quotename,sb1_numberofsubscribers,sb1_numberofmembers,sb1_minage,sb1_maxage,sb1_averageage"
        ).then(
            function (result) {
                var formParameters = {
                    name: result.name,
                    description: result.description,
                    sb1_quotetype: 1, // ✅ Directly set quotetype = 1 on open form
                    effectivefrom: result.effectivefrom,
                    effectiveto: result.effectiveto,
                    sb1_region: result.sb1_region,
                    sb1_marketsegment: result.sb1_marketsegment,
                    sb1_foldermode: result.sb1_foldermode,
                    sb1_lineofbusiness: result.sb1_lineofbusiness,
                    sb1_brokerid: result.sb1_brokerid,
                    sb1_numberofsubscribers: result.sb1_numberofsubscribers,
                    sb1_numberofmembers: result.sb1_numberofmembers,
                    sb1_minage: result.sb1_minage,
                    sb1_maxage: result.sb1_maxage,
                    sb1_averageage: result.sb1_averageage,
                    billto_line1: result.billto_line1,
                    billto_line2: result.billto_line2,
                    billto_city: result.billto_city,
                    sb1_billtostate: result.sb1_billtostate,
                    billto_postalcode: result.billto_postalcode,
                    sb1_billtocountry: result.sb1_billtocountry,
                    totallineitemamount: result.totallineitemamount,
                    discountpercentage: result.discountpercentage,
                    discountamount: result.discountamount,
                    totaltax: result.totaltax,
                    totalamount: result.totalamount
                };

                // 🔹 Lookup mappings
                if (result._customerid_value) {
                    formParameters["customerid"] = result._customerid_value;
                    formParameters["customeridname"] = result["_customerid_value@OData.Community.Display.V1.FormattedValue"];
                    formParameters["customeridtype"] = result["_customerid_value@Microsoft.Dynamics.CRM.lookuplogicalname"];
                }

                if (result._opportunityid_value) {
                    formParameters["opportunityid"] = result._opportunityid_value;
                    formParameters["opportunityidname"] = result["_opportunityid_value@OData.Community.Display.V1.FormattedValue"];
                    formParameters["opportunityidtype"] = result["_opportunityid_value@Microsoft.Dynamics.CRM.lookuplogicalname"];
                }

                if (result._pricelevelid_value) {
                    formParameters["pricelevelid"] = result._pricelevelid_value;
                    formParameters["pricelevelidname"] = result["_pricelevelid_value@OData.Community.Display.V1.FormattedValue"];
                    formParameters["pricelevelidtype"] = result["_pricelevelid_value@Microsoft.Dynamics.CRM.lookuplogicalname"];
                }

                if (result._sb1_broker_value) {
                    formParameters["sb1_broker"] = result._sb1_broker_value;
                    formParameters["sb1_brokername"] = result["_sb1_broker_value@OData.Community.Display.V1.FormattedValue"];
                    formParameters["sb1_brokertype"] = result["_sb1_broker_value@Microsoft.Dynamics.CRM.lookuplogicalname"];
                }

                var entityFormOptions = {
                    entityName: "quote",
                    useQuickCreateForm: false
                };

                console.log("Opening new quote form with parameters:", formParameters);

                // ✅ Open new form with quotetype=1 prefilled
                Xrm.Navigation.openForm(entityFormOptions, formParameters).then(
                    function (success) {
                        console.log("✅ Renew Quote form opened successfully!", success);

                        // Wait and then run restrictPastDates logic
                        setTimeout(function () {
                            var formContext = Xrm.Page;
                            if (!formContext) return;

                            var choiceAttr = formContext.getAttribute("sb1_quotetype");
                            if (choiceAttr) {
                                console.log("🟢 QuoteType value found:", choiceAttr.getValue());

                                if (choiceAttr.getValue() === 1) {
                                    console.log("🔹 Running restrictPastDates() because QuoteType = 1");
                                    restrictPastDates({ getFormContext: () => formContext });
                                } else if (choiceAttr.getValue() === 2) {
                                    console.log("🔹 Running validateEffectiveFormDate() because QuoteType = 2");
                                    validateEffectiveFormDate({ getFormContext: () => formContext });
                                }
                            }
                        }, 2500);
                    },
                    function (error) {
                        console.error("❌ Error opening Quote form:", error.message);
                    }
                );
            },
            function (error) {
                console.error("❌ Error retrieving Quote record:", error.message);
            }
        );
    }

    function addQuote(formContext) {
        try {
            var recordId = formContext.data.entity.getId();
            if (!recordId) {
                Xrm.Navigation.openAlertDialog({ text: "Please save the record before creating a Quote." });
                return;
            }
            recordId = recordId.replace("{", "").replace("}", "");

            var entityName = formContext.data.entity.getEntityName(); // e.g., 'opportunity' or 'sb1_broker'

            //  If entity is Opportunity, fetch its details
            if (entityName === "opportunity") {
                Xrm.WebApi.retrieveRecord("opportunity", recordId, "?$select=name,_parentaccountid_value").then(
                    function (result) {
                        openQuoteForm(result.name, recordId, result["_parentaccountid_value"], result["_parentaccountid_value@OData.Community.Display.V1.FormattedValue"]);
                    },
                    function (error) {
                        console.warn("⚠️ Failed to fetch Opportunity. Opening Quote form without Account.");
                        openQuoteForm(null, recordId, null, null);
                    }
                );
            }
            else {
                // If entity is not Opportunity (like Broker), directly open Quote
                console.log("ℹ No Opportunity relation found. Opening Quote form directly.");
                openQuoteForm(null, null, null, null);
            }
        } catch (e) {
            console.error(" Error in addQuote:", e);
            Xrm.Navigation.openErrorDialog({ message: e.message });
        }
    }

    // 🔹 Helper function to open Quote form
    function openQuoteForm(opportunityName, opportunityId, accountId, accountName) {
        try {
            var formParameters = {};

            // Add Opportunity (optional)
            if (opportunityId) {
                formParameters["opportunityid"] = opportunityId;
                formParameters["opportunityidname"] = opportunityName || "";
                formParameters["opportunityidtype"] = "opportunity";
            }

            // Add Account (optional)
            if (accountId) {
                formParameters["customerid"] = accountId;
                formParameters["customeridname"] = accountName || "";
                formParameters["customeridtype"] = "account";
            }

            var entityFormOptions = {
                entityName: "quote",
                useQuickCreateForm: false
            };

            Xrm.Navigation.openForm(entityFormOptions, formParameters).then(
                function () {
                    console.log(" Quote form opened successfully.");
                },
                function (error) {
                    console.error(" Error opening Quote form:", error);
                    Xrm.Navigation.openErrorDialog({ message: error.message });
                }
            );
        } catch (ex) {
            console.error(" Error inside openQuoteForm:", ex);

        }
    }

    async function callQuoteAPI(executionContext) {
        alert("Fire!");
    }



    return {
        copyQuote: copyQuote,
        renewQuote: renewQuote,
        renewQuoteForSubgrid: renewQuoteForSubgrid,
        copyQuoteFromSubgrid: copyQuoteFromSubgrid,
        onFormLoad: onFormLoad,
        restrictPastDates: restrictPastDates,
        validateEffectiveFromDate: validateEffectiveFromDate,
        addQuote: addQuote,
        callQuoteAPI: callQuoteAPI


    };
})();
