using System;

using System.Net.Http;

using System.Text;

using System.Threading.Tasks;

using Microsoft.Xrm.Sdk;

using Microsoft.Xrm.Sdk.Query;

using Newtonsoft.Json;
 
public class SaveandSyncQuote : IPlugin

{

    public void Execute(IServiceProvider serviceProvider)

    {

        ITracingService tracing =

            (ITracingService)serviceProvider.GetService(typeof(ITracingService));
 
        IPluginExecutionContext context =

            (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
 
        IOrganizationServiceFactory serviceFactory =

            (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
 
        IOrganizationService orgService =

            serviceFactory.CreateOrganizationService(null);
 
        tracing.Trace("==== Custom API sb1_saveandsyncquote Started ====");
 
        try

        {

            // ── ENV VARIABLES ─────────────────────────────

            string apiBaseUrl = GetEnvironmentVariable(orgService, "sb1_apibaseurl");

            string grantType = GetEnvironmentVariable(orgService, "sb1_granttype");

            string username = GetEnvironmentVariable(orgService, "sb1_usernamefortoken");

            string password = GetEnvironmentVariable(orgService, "sb1_tokenpassword");

            string apiKey = GetEnvironmentVariable(orgService, "sb1_apikey");
 
            // ── Read Input ─────────────────────────────────────────────

            string quotePayloadJson =

                context.InputParameters.Contains("sb1_quotepayload")

                    ? context.InputParameters["sb1_quotepayload"].ToString()

                    : "{}";
 
            dynamic payload = JsonConvert.DeserializeObject(quotePayloadJson);
 
            // ── Duplicate Check (Safe) ─────────────────────────────────

            int formType = SafeInt(payload?.form_type);

            string workflowLabel = SafeString(payload?.workflow_category_label);
 
            // Skip duplicate check for Copy & Renew

            bool skipDuplicateCheck =

                workflowLabel.Equals("Copy", StringComparison.OrdinalIgnoreCase) ||

                workflowLabel.Equals("Renew", StringComparison.OrdinalIgnoreCase);
 
            if (formType == 1 && !skipDuplicateCheck)

            {

                string quoteName = SafeString(payload?.name);
 
                if (!string.IsNullOrWhiteSpace(quoteName))

                {

                    var query = new QueryExpression("quote")

                    {

                        ColumnSet = new ColumnSet("name")

                    };
 
                    query.Criteria.AddCondition("name", ConditionOperator.Equal, quoteName);
 
                    var existingQuotes = orgService.RetrieveMultiple(query);
 
                    if (existingQuotes.Entities.Count > 0)

                    {

                        SetResponse(context, false, $"Quote with name '{quoteName}' already exists.");

                        return;

                    }

                }

            }
 
            // ── Get Account (Safe) ─────────────────────────────────────

            string accountGuid = SafeString(payload?.account_id);

            string accId = "0";

            string accName = SafeString(payload?.account_name);
 
            if (Guid.TryParse(accountGuid, out Guid accGuidParsed))

            {

                Entity account = orgService.Retrieve(

                    "account",

                    accGuidParsed,

                    new ColumnSet("sb1_accountid", "name")

                );
 
                accId = account.Contains("sb1_accountid")

                    ? account["sb1_accountid"].ToString()

                    : "0";
 
                accName = account.Contains("name")

                    ? account["name"].ToString()

                    : accName;

            }
 
            // ── Prepare B1 Payload ────────────────────────────────────

            var b1Payload = new

            {

                AccountId = SafeInt(accId),

                AccountName = accName,

                FolderName = SafeString(payload?.name),

                FolderEffectiveDate = SafeString(payload?.effective_from),

                MarketSegment = SafeString(payload?.market_segment),

                LineofBusiness = SafeString(payload?.line_of_business),

                FundingArrangement = SafeString(payload?.funding_arrangement),

                State = SafeString(payload?.state),

                Region = SafeString(payload?.region),

                Admin = new { },

                CrmAccountMetaData = new { },

                CrmQuoteMetaData = new { },

                FolderMode = SafeString(payload?.folder_mode)

            };
 
            string jsonBody = JsonConvert.SerializeObject(b1Payload);

            tracing.Trace("Prepared B1 JSON: " + jsonBody);
 
            // ── API Calls (Safe) ──────────────────────────────────────

            string token = GetAccessToken(apiBaseUrl, grantType, username, password)

                .GetAwaiter().GetResult();
 
            string apiResponse = CallB1Api(jsonBody, token, tracing, apiBaseUrl, apiKey)

                .GetAwaiter().GetResult();
 
            dynamic b1ResponseObj = JsonConvert.DeserializeObject(apiResponse);
 
            bool isSuccess =

                b1ResponseObj?.Result?.Status != null &&

                ((string)b1ResponseObj.Result.Status)

                    .Equals("Success", StringComparison.OrdinalIgnoreCase);
 
            if (!isSuccess)

            {

                SetResponse(context, false, "B1 API call failed.", b1ResponseObj);

                return;

            }
 
            // ── Extract API Data (Safe) ───────────────────────────────

            int folderVersionId = SafeInt(

                b1ResponseObj?.Result?.Data?.EbsAdditionalDetail?.FolderVersion?.FolderVersionId

            );
 
            string quoteIdFromApi = SafeString(

                b1ResponseObj?.Result?.Data?.EbsAdditionalDetail?.Folder?.QuoteId

            );
 
            int quoteFolderId = SafeInt(

                b1ResponseObj?.Result?.Data?.EbsDetailsForCrm?.QuoteFolderId

            );
 
            // ── Create Quote ──────────────────────────────────────────

            Entity newQuote = new Entity("quote");
 
            newQuote["sb1_quoteid"] = folderVersionId.ToString();

            newQuote["sb1_quotefoldername"] = quoteIdFromApi;

            newQuote["name"] = SafeString(payload?.name);
 
            string folderMode = SafeString(payload?.folder_mode);
 
            if (!string.IsNullOrWhiteSpace(folderMode))

            {

                newQuote["sb1_foldermode"] = folderMode;

            }
 
            if (quoteFolderId > 0)

                newQuote["sb1_folderid"] = quoteFolderId.ToString();
 
            // Account

            if (Guid.TryParse(accountGuid, out Guid accRef))

                newQuote["customerid"] = new EntityReference("account", accRef);
 
            // Owner

            if (Guid.TryParse(SafeString(payload?.owner_id), out Guid ownerGuid))

                newQuote["ownerid"] = new EntityReference("systemuser", ownerGuid);
 
            // Opportunity

            if (Guid.TryParse(SafeString(payload?.opportunity_id), out Guid oppGuid))

                newQuote["opportunityid"] = new EntityReference("opportunity", oppGuid);
 
            // Broker

            if (Guid.TryParse(SafeString(payload?.broker_guid), out Guid brokerGuid))

                newQuote["sb1_broker"] = new EntityReference("contact", brokerGuid);
 
            newQuote["sb1_brokerid"] = SafeString(payload?.broker_code);
 
            // Fields

            newQuote["sb1_lineofbusiness"] = SafeString(payload?.line_of_business);

            newQuote["sb1_marketsegment"] = SafeString(payload?.market_segment);

            newQuote["sb1_fundingarrangement"] = SafeString(payload?.funding_arrangement);

            newQuote["sb1_state"] = SafeString(payload?.state);

            newQuote["sb1_region"] = SafeString(payload?.region);
 
            // Effective From

            if (DateTime.TryParse(SafeString(payload?.effective_from), out DateTime effFrom))

                newQuote["effectivefrom"] = effFrom;
 
            // Workflow Category (OptionSet)

            int workflowVal = SafeInt(payload?.workflow_category_value);
 
            if (workflowVal >= 0)

                newQuote["sb1_quotetype"] = new OptionSetValue(workflowVal);
 
            // Revision Number

            string revision = SafeString(payload?.revision_id);
 
            if (!string.IsNullOrWhiteSpace(revision))

                newQuote["revisionnumber"] = revision;
 
            // ── New Numeric Fields ─────────────────────────────────────

            int subscribers = SafeInt(payload?.number_of_subscribers);

            if (subscribers > 0)

                newQuote["sb1_numberofsubscribers"] = subscribers;
 
            int members = SafeInt(payload?.number_of_members);

            if (members > 0)

                newQuote["sb1_numberofmembers"] = members;
 
            int minAge = SafeInt(payload?.min_age);

            if (minAge > 0)

                newQuote["sb1_minage"] = minAge;
 
            int maxAge = SafeInt(payload?.max_age);

            if (maxAge > 0)

                newQuote["sb1_maxage"] = maxAge;
 
            int avgAge = SafeInt(payload?.average_age);

            if (avgAge > 0)

                newQuote["sb1_averageage"] = avgAge;
 
            Guid newQuoteId = orgService.Create(newQuote);
 
            // ── Success Response ──────────────────────────────────────

            SetResponse(

                context,

                true,

                "Quote created successfully.",

                new

                {

                    CreatedQuoteId = newQuoteId.ToString(),

                    B1ApiResponse = b1ResponseObj

                }

            );
 
            tracing.Trace("==== Completed Successfully ====");

        }

        catch (Exception ex)

        {

            tracing.Trace("ERROR: " + ex.ToString());

            SetResponse(context, false, ex.Message);

        }

    }
 
    // ── Safe Helpers ───────────────────────────────────────────────

    private string SafeString(dynamic val)

    {

        try { return val != null ? val.ToString() : string.Empty; }

        catch { return string.Empty; }

    }
 
    private int SafeInt(dynamic val)

    {

        try { return val != null ? Convert.ToInt32(val) : 0; }

        catch { return 0; }

    }
 
    // ── Response ───────────────────────────────────────────────────

    private void SetResponse(

        IPluginExecutionContext context,

        bool success,

        string message,

        object data = null)

    {

        var response = new

        {

            success = success,

            message = message,

            data = data

        };
 
        context.OutputParameters["sb1_response"] =

            JsonConvert.SerializeObject(response);

    }
 
    // ── TOKEN ──────────────────────────────────────────────────────

    private async Task<string> GetAccessToken(

        string apiBaseUrl,

        string grantType,

        string username,

        string password)

    {

        using (var client = new HttpClient())

        {

            string url = $"{apiBaseUrl}/Token";
 
            var body = new StringContent(

                $"grant_type={grantType}&username={username}&password={password}",

                Encoding.UTF8,

                "application/x-www-form-urlencoded"

            );
 
            var response = await client.PostAsync(url, body);

            response.EnsureSuccessStatusCode();
 
            string json = await response.Content.ReadAsStringAsync();

            dynamic tokenObj = JsonConvert.DeserializeObject(json);
 
            return tokenObj.access_token;

        }

    }
 
    // ── API Call ───────────────────────────────────────────────────

    private async Task<string> CallB1Api(

        string jsonBody,

        string token,

        ITracingService tracing,

        string apiBaseUrl,

        string apiKey)

    {

        using (var client = new HttpClient())

        {

            string url = $"{apiBaseUrl}/Quote/Blank/New?api_key={apiKey}";
 
            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");

            client.DefaultRequestHeaders.Add("Accept", "application/json");
 
            var content = new StringContent(

                jsonBody,

                Encoding.UTF8,

                "application/json"

            );
 
            var response = await client.PostAsync(url, content);
 
            string result = await response.Content.ReadAsStringAsync();

            tracing.Trace("API Response: " + result);
 
            return result;

        }

    }
 
    // ── ENV VARIABLE FETCH ───────────────────────

    private string GetEnvironmentVariable(IOrganizationService service, string name)

    {

        var query = new QueryExpression("environmentvariabledefinition")

        {

            ColumnSet = new ColumnSet("defaultvalue"),

            Criteria =

            {

                Conditions =

                {

                    new ConditionExpression("schemaname", ConditionOperator.Equal, name)

                }

            }

        };
 
        var result = service.RetrieveMultiple(query);
 
        if (result.Entities.Count == 0)

            throw new Exception($"Environment variable '{name}' not found");
 
        return result.Entities[0]["defaultvalue"].ToString();

    }

}
 