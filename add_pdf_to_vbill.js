/**
 *@NApiVersion 2.x1
 */
define(['N/error', 'N/log', 'N/record', 'N/search', 'N/file'], function (error, log, record, search, file) {
    
    function postSubmit(options) {
        try {
            log.debug({
                title: 'Received Options',
                details: options
            });

            if (!options.preMapData || !Array.isArray(options.preMapData) || options.preMapData.length === 0) {
                throw error.create({
                    name: 'MISSING_DATA',
                    message: 'preMapData array is missing or empty',
                    notifyOff: false
                });
            }

            let responseArray = [];

            options.preMapData.forEach(function (workOrder) {
                var workOrderNumber = workOrder.WorkOrderNumber;
                var netsuiteFileId = workOrder.NetSuiteFileId;
                
                if (!workOrderNumber || !netsuiteFileId) {
                    log.error({
                        title: 'Skipping entry - Missing WorkOrderNumber or NetSuiteFileId',
                        details: workOrder
                    });
                    responseArray.push({
                        statusCode: 400,
                        message: 'Missing WorkOrderNumber or NetSuiteFileId'
                    });
                    return;
                }

                var vendorBillId = null;
                var vendorBillSearch = search.create({
                    type: 'vendorbill',
                    filters: [['custbody_kes_work_order_id', 'is', workOrderNumber]],
                    columns: ['internalid']
                });
                
                var searchResult = vendorBillSearch.run().getRange({ start: 0, end: 1 });
                if (searchResult.length > 0) {
                    vendorBillId = searchResult[0].getValue('internalid');
                }

                if (!vendorBillId) {
                    log.error({
                        title: 'Vendor Bill Not Found',
                        details: 'No Vendor Bill found for WorkOrderNumber: ' + workOrderNumber
                    });
                    responseArray.push({
                        statusCode: 404,
                        message: 'Vendor Bill not found for WorkOrderNumber: ' + workOrderNumber
                    });
                    return;
                }

                log.debug({
                    title: 'Processing Work Order',
                    details: 'WorkOrderNumber: ' + workOrderNumber + ', VendorBillId: ' + vendorBillId + ', FileId: ' + netsuiteFileId
                });

                var vendorBill = record.load({
                    type: record.Type.VENDOR_BILL,
                    id: vendorBillId,
                    isDynamic: true
                });

                var fileObj = file.load({ id: netsuiteFileId });

                record.attach({
                    record: {
                        type: 'file',
                        id: netsuiteFileId
                    },
                    to: {
                        type: 'vendorbill',
                        id: vendorBillId
                    }
                });

                vendorBill.save();

                log.debug({
                    title: 'Success',
                    details: 'File ' + netsuiteFileId + ' attached to Vendor Bill ' + vendorBillId
                });

                responseArray.push({
                    statusCode: 200,
                    message: 'File attached successfully',
                    workOrderNumber: workOrderNumber,
                    vendorBillId: vendorBillId,
                    fileAttached: netsuiteFileId
                });
            });

            return responseArray; 

        } catch (e) {
            log.error({
                title: 'Error in postSubmit',
                details: e
            });
            return [{
                statusCode: 500,
                message: 'Internal Server Error',
                error: e.message
            }];
        }
    }

    return {
        postSubmit: postSubmit
    };
});
