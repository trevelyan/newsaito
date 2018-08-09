
  $('.loader').hide();
  $('.main').show();

  $('.modsearch_button').off();
  $('.modsearch_button').on('click', function() {

      var searchterm = $('#search').val();

      $.getJSON('/appstore/search/'+searchterm, function (data) {
        let htab = returnRowHTML(data.modules);
        $('#optional_modules').empty();
        $('#optional_modules').append(htab);
        console.log(JSON.stringify(data));
        attachEvents(data.modules);
      });

  });

  $('.modsearch').off();
  $('.modsearch').on('keydown', function(evt) {
    if (evt.keyCode == 13) {

      var searchterm = $('#search').val();

      $.getJSON('/appstore/search/'+searchterm, function (data) {
        let htab = returnRowHTML(data.modules);
        $('#optional_modules').empty();
        $('#optional_modules').append(htab);
        console.log(JSON.stringify(data));
        attachEvents(data.modules);
      });

    }
  });




function returnRowHTML(rows) {

  html = '';

  for (let i = 0; i < rows.length; i++) {
    row = rows[i];
    html += ' \
    <tr id="noncore_app_'+row.app_id+'" class="module_row"> \
      <td class="module_checkbox"><input type="checkbox" id="opt_app_'+row.id+'" name="app_'+row.id+'" value="" /></td> \
      <td><div class="module_info_title">'+row.title+'</div> \
        <div class="module_info_version">(v.'+row.version+')</div> \
        <div class="module_info_description">'+row.description+'</div> \
        <div class="module_info_publisher"><span style="font-size:0.9em;font-weight:bold;">publisher:</span><br/>'+row.publisher+'</div> \
      </td> \
    </tr> \
    ';
  }

  return html;

};

function attachEvents(rows) {

  for (let i = 0; i < rows.length; i++) {
    var cxbx = "#opt_app_"+rows[i].id;
    var ctab = "#noncore_app_"+rows[i].app_id;
    $(cxbx).val(JSON.stringify(rows[i]));

    $(cxbx).off();
    $(cxbx).on('click', function() {
      addModuleToCoreTable($(cxbx).val());  
      $(ctab).remove();
    });
  }

}

function addModuleToCoreTable(appjson) {

  var row = JSON.parse(appjson);
  var row_id = "#core_app_" + row.app_id;  

  if (!$(row_id).length) {

    htab = ' \
    <tr class="module_row" id="core_app_'+row.app_id+'"> \
     <td class="module_checkbox"><input type="checkbox" id="app_'+row.id+'" name="app_'+row.id+'" value="'+row.app_id+'" checked /></td> \
     <td class="module_info"><div class="module_info_title">'+row.title+'</div> \
        <div class="module_info_version">(v.'+row.version+')</div> \
        <div class="module_info_description">'+row.description+'</div> \
        <div class="module_info_publisher"><span style="font-size:0.9em;font-weight:bold;">publisher:</span><br/>'+row.publisher+'</div> \
      </td> \
    </tr> \
    ';
    $('#core_modules').append(htab);

  }
}






