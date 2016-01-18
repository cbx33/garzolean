// Version 0.9
// TODOs:
// * Make column names variables at the top
// * Use the whole object instead of using the transport system to create simpler objects
// * Don't use the awful panel handling, but return the objects in their date containers so panel handling is easier

// These are broken out from the code so that if at any point you wanted to change the spreadsheet it
// pointed to, or change the sheet names, you could. This is also useful for development, as it means
// you can copy this whole file and just change a few variables to get it to look at an entirely new
// spreadsheet.
var internals_sheet = "1bS74m5a9TqB0Ao5Hpp32rIT4jnQo1MbQ4Evx2-ZUSog"
var orders_sheet = "1u4P9BDXJ4EdRsqktrCWAX0Wdj2wNchHVTL266_HNto8"
var orders_sheet_name = "Sheet9"
var colours_sheet_name = "Colours"
var stateflow_sheet_name = "StateFlows"
var order_complete = "Delivery #"
var finished_state = ["P"]

function getOrder(){
  // This function is responsible for getting the order or the states and dumping that into an array
  // It works by looking at the order of the rows in the Colours Sheet.
  var c = [];
  var ssheet = SpreadsheetApp.openById(internals_sheet)
  var sheet =  ssheet.getSheetByName(colours_sheet_name)
  var range = sheet.getDataRange();
  var data = range.getValues();
  
  // Here we simply loop over all the elements in the Colours Sheet data, and create a new array item
  // at point 'i' in the list and set it to the value in the 'i'th row, 0th column. This will basically
  // then just return a list of states in order, like so ['S', 'L', 'C', 'D', 'R', 'P']
  for (var i in data){
    c[i] = data[i][0]
  }
  return c; 
}

// This caches the state order as calling this function each time in the sort method crippled the system.
// This is way more performance happy ;)
var order = getOrder();

function getSheet(){
  // This function simply returns the orders sheet
  var ssheet = SpreadsheetApp.openById(orders_sheet)
  sheet =  ssheet.getSheetByName(orders_sheet_name)
  return sheet
}

function getFlows(){
  // This function returns the StateFlows in a simple to digest, 2D array.
  var c = [];
  var ssheet = SpreadsheetApp.openById(internals_sheet)
  var sheet =  ssheet.getSheetByName(stateflow_sheet_name)
  var range = sheet.getDataRange();
  var data = range.getValues();
  for (var i in data){
    c[i] = []
    for (var j in data){
      //i, j = i, j ## No swapping or anything here, one to one mapping.
      c[i][j] = data[i][j]
    }
  }
  return c;
}

function colourCache(){
  // This function returns a dictionary of colors to statenames for easy lookup inside the
  // code. It's used both inside Code.gs, and inside list.html. It will return something like
  // {'S': 'danger', 'L': 'warning'}
  var c = {};
  var ssheet = SpreadsheetApp.openById(internals_sheet)
  var sheet =  ssheet.getSheetByName(colours_sheet_name)
  var range = sheet.getDataRange();
  var data = range.getValues();
  for (var i in data){
    if (data[i][1] != null){
      c[data[i][0]] = data[i][1]
    }
    else{
      c[data[i][0]] = "primary"
    }
  }
  return c;
}

// Again here we are just caching the colour cache for later use.
var colourCacheVar = colourCache();

function flowsForStates(){
  // This function is only used once and so we don't bother to cache it though
  // there's no reason not to. We iterate through the 2D State array from the
  // getFlows() function and create a new dictionary of allowable transitions
  // for each particular State. For example, if state S, is only allowed to go
  // to state C or L, then the data would look something like
  // {'S': [['L', 'To L'], ['C', 'To C']]}
  var ret = {};
  flows = getFlows()
  // Note that flow = 1 to start with so that we strip out the header row
  for (var flow = 1; flow < flows.length; flow++){
    var state_transitions = []
    // Note that to_state = 1 to skip the column row
    for (var to_state = 1; to_state < flows[flow].length; to_state++){
      // If the state is not null then push that state transition into the array
      // for that state.
      if (flows[flow][to_state] != ""){
        state_transitions.push([flows[0][to_state], flows[flow][to_state]])
      }
    }
    // Here we add the allowed state transitions into the dictionary for that state
    ret[flows[flow][0]] = state_transitions
  }
  return ret
}

function getDataForDisplay(){
  // This is a convenience function that returns the data returned by the getSheet() function
  // The raw data is used by the updateSheet function
  var sheet = getSheet()
  var range = sheet.getDataRange()
  var data = range.getValues();
  return data
}

function updateSheet(oid, op){
  // This function is resposible for updating the spreadsheet. It is passed two parameters,
  // the oid (order id) and the op (operation). The operation is the state that it will move
  // into. 
  data = getDataForDisplay();
  headers = data[0];
  // Here we go through and find the numeric values of the columns that contain the headers.
  // This means you can change the column orders on the sheet without breaking the code.
  // Again, this _could_ be cached, but updates to the sheet will be rare, and it's just iterating
  // over one row.
  for (var i=0; i<headers.length; i++){
    if (headers[i] == "Delivery #"){
      var oid_col = i
    }
    if (headers[i] == "Tick box"){
      var op_col = i
    }
  }
  
  // This loop finds the oid (order id) of the item. Once the oid is found it's set to range_row to
  // be used later on. We break out of the loop on the first oid found.
  for (var i=1; i<data.length; i++){
    if (data[i][oid_col] == oid){
      var range_row = i;
      break;
    }
  }
  
  // Now we actually "set" the value. Notice that the op_col is used from before, along with the
  // range_row from the loop we just broke out of. Notice also the + 1 modifiers. When setting,
  // the range row/col identifiers do not start from 0, but from 1, as you would expect; Cell A1,
  // is the first cell, not cell A0
  if (range_row){
    var sheet = getSheet();
    var range = sheet.getRange(range_row + 1, op_col + 1)
    range.setValue(op)
  }
  // Finally we generate the output, that is the state of all the orders, and return it. We can
  // absolutely be smarter here, and only update the particular order we are talking about, but
  // as the updates are going to be rare, regenerating the whole sheet isn't that expensive.
  return genOutput();
}

function retDateObj(obj){
  // This function takes a date object in "string" format "10/10/90" and turns it into a date
  // object. It could very well be that if we now made the date columns back to proper dates
  // again, we could dispense with this function but..........
  var nums = obj.split("/")
  return new Date(nums[2], nums[1], nums[0], 0, 0, 0, 0)
}

function sortTP(a, b)
{
  // This is an exceedingly IMPORTANT function that handles the sorting for the entire page.
  // sortTP() is used by the processData function after the data has been processed to get it
  // ready for genOutput(). We are using the standard Javascript sort and supplying our custom
  // sort function. Basically if a > b we return 1, if b > a we return -1 and if they are the
  // same we return 0. (It could be the other way around, but the principle is the same)
  // To start with we first compare if it has a date or not, that's the first groupings. Ones
  // that don't have a date are placed at the the end.
  
  d1string = a['Collection Date']
  d2string = b['Collection Date']
  if ((d1string == "") && !(d2string == "")){
    return 1
  }
  if ((d2string == "") && !(d1string == "")){
    return -1
  }
  
  // Now we compare the actual dates to see how they rank.
  d1 = retDateObj(a['Collection Date'])
  d2 = retDateObj(b['Collection Date'])
  var dd = d1 - d2
  if (dd != 0){
    return dd
  }

  // We now check the Urgent flag.
  if ((a['Urgent'] == "") && !(b['Urgent'] == "")){
    return 1
  }
  if ((b['Urgent'] == "") && !(a['Urgent'] == "")){
    return -1
  }

  // If the dates are the same, we get into the last block here which compares the
  // order of the states and reverses them. Putting the b before the a accomplishes
  // the reversing nature.
  return order.indexOf(b['Tick box']) - order.indexOf(a['Tick box']);
}

function processData(data){
  // Another important function. This one generates an array (this is important as it needs
  // to be ordered), of all the orders. The "transport" variable tells it what data to include
  // when it generates the new order object to pass back to the HTML page for rendering.
  // This is a bit of a speed hack, there's no need to pass back "ALL" the data, so we only
  // pass back the ones that are needed.
  var new_data = []
  var headers = {}
  var transport = ['Date', 'Customer', 'Delivery #', 'Tick box', 'Collection Date', 'Urgent']
  
  // Another header lookup, gosh we should functionalize this ;)
  for (cell in data[0]){
    headers[data[0][cell]] = cell
  }
  
  // Now we iterate through all the records
  for (var row = 0; row < data.length; row++){
    // If the state is not the "finished" state, then we need to return the record to be displayed.
    if ((finished_state.indexOf(data[row][headers['Tick box']]) == -1) && (data[row][headers[order_complete]] != ''))
    {
      // Now we iterate through each of the headers to create our "object", it could be that just passing
      // the whole object is just as quick. I'm not sure why I did it this way, but it works. If things get slow
      // this could be an optimization point. The object creation is inside the if, so it only happens if we are
      // going to pass the object back.
      new_record = {}
      for (var i=0; i < transport.length; i++){
        new_record[transport[i]] = data[row][headers[transport[i]]];
      }
      // We add a color variable here. This uses the color cache to look up what color the state should be.
      new_record['_color'] = "btn-" + colourCacheVar[new_record['Tick box']]
      new_data.push(new_record)
    }
  }
  // Now sort the data before returning it.
  new_data.sort(sortTP)
  return new_data
}

function genOutput() {
  // Another often called function. This actually creates the html that is displayed on the page. This
  // could and indeed I think used to be done in the list.html. Part of me wants to move it there, but
  // in this way, the data is processed on the server and not on the client, minimising load on the client
  // machine.
  data = processData(getDataForDisplay())
  output = ""
  
  // We loop through all the items of data.
  for (var i = 1; i < data.length; i++) {
    icon = ""
    start_bold = ""
    end_bold = ""
    if (data[i]['Urgent']){
      icon = '<div style="float:left"><span class="glyphicon glyphicon-fire" aria-hidden="true" style="font-size: x-large; padding-right:4px;"></span></div>'
      start_bold = "<strong>"
      end_bold = "</strong>"
    }
    // If this is the "FIRST" item in the list, we need to put the beginning header for the date.
    // (Note: we could do this differently, and pass a dict of dates, containing all the objects in that
    // date. It would make some of this code less reliant on sorting, but again, it's working as it is
    // and isn't causing a significant performance hit, just less nice to maintain.
    if (i == 1) {
      output += '<div class="panel panel-default"> \
          <div class="panel-heading">' + data[i]['Collection Date'] + '</div> \
          <div class="panel-body">'
    }
    // If the dates do not match, it means we need a new panel.
    else if (i > 1 && data[i]['Collection Date'] != data[i-1]['Collection Date']){
      output += '</div> \
        </div> \
        <div class="panel panel-default"> \
        <div class="panel-heading">' + data[i]['Collection Date'] + '</div> \
        <div class="panel-body">'
    }
    // Now we add the html for the buttons themselves taking all the information into account.
    // ((I've just had a thought, we can probably pass the data objects as it, because they are
    // all getting processed in here now.))
    output += '<button data-id="' + data[i]['Delivery #'] + '" data-state="' + data[i]['Tick box'] +'" type="button" class="btn ' + data[i]['_color'] +'" style="margin-bottom: 3px;"> \
       ' + icon + start_bold + data[i]['Customer']
    if (data[i]['Delivery #']) {
    output += '<br />' + data[i]['Delivery #']
    }
    output += end_bold + '</button>'
  }
  output += '</div>\
      </div>'
  return output
}

function getLastUpdateTime()
{
  // Returns a string representation of the last time the order sheet was updated.
  // This means we only need to update the page when the spreadsheet was actually updated
  // Far more efficient!
  ap = DriveApp.getFileById(orders_sheet).getLastUpdated();
  formattedDate = Utilities.formatDate(ap, "GMT", "yyyy-MM-dd'T'HH:mm:ss'Z'");
  Logger.log(formattedDate)
  return formattedDate
}

function doGet(e) {
  // The most important function of all! Without this "Nothing is output!!"
  var ret = HtmlService.createTemplateFromFile("list.html")
  ret.data = processData(getDataForDisplay())
  return ret.evaluate()
}
