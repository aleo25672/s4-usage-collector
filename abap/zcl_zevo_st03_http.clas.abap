CLASS zcl_zevo_st03_http DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES if_http_extension.

  PRIVATE SECTION.
    METHODS write_json
      IMPORTING
        io_server TYPE REF TO if_http_server
        iv_status TYPE i
        iv_json   TYPE string.

    METHODS escape_json
      IMPORTING iv_value TYPE clike
      RETURNING VALUE(rv_value) TYPE string.
ENDCLASS.


CLASS zcl_zevo_st03_http IMPLEMENTATION.

  METHOD if_http_extension~handle_request.
    DATA: lv_method   TYPE string,
          lv_pertyp   TYPE swncperitype,
          lv_perstr   TYPE swncdatum,
          lv_sysid    TYPE swncsysid,
          lv_inst     TYPE swnchostname,
          lv_tmp      TYPE string,
          lv_json     TYPE string,
          lv_first    TYPE abap_bool,
          lv_piece    TYPE string,
          ls_tt       TYPE swncaggtasktype,
          ls_tc       TYPE swncaggtcdet,
          lt_tasktype TYPE TABLE OF swncaggtasktype,
          lt_tcdet    TYPE TABLE OF swncaggtcdet,
          lt_users    TYPE TABLE OF swncagguserworkload,
          lt_usertc   TYPE TABLE OF swncaggusertcode,
          lt_times    TYPE TABLE OF swncaggtimes,
          lt_rfcclnt  TYPE TABLE OF swncaggrfcclnt,
          lt_rfcsrvr  TYPE TABLE OF swncaggrfcsrvr,
          lt_hit_resp TYPE TABLE OF swnchitlist,
          lt_hit_db   TYPE TABLE OF swnchitlist,
          ls_uw       TYPE swncagguserworkload,
          ls_ut       TYPE swncaggusertcode,
          ls_tm       TYPE swncaggtimes,
          ls_rc       TYPE swncaggrfcclnt,
          ls_rs       TYPE swncaggrfcsrvr,
          ls_h        TYPE swnchitlist,
          lv_rows     TYPE i,
          lv_limit    TYPE i VALUE 200,
          lv_tt_x     TYPE x LENGTH 1,
          lv_tt_hex   TYPE c LENGTH 2,
          lv_tt_name  TYPE string,
          lv_user     TYPE string.

    lv_method = to_upper( server->request->get_header_field( '~request_method' ) ).
    IF lv_method <> 'GET'.
      write_json( io_server = server iv_status = 405
                  iv_json = '{"error":"Only GET is supported"}' ).
      RETURN.
    ENDIF.

    lv_tmp = server->request->get_form_field( 'periodType' ).
    IF lv_tmp IS INITIAL.
      lv_pertyp = 'D'.
    ELSE.
      lv_pertyp = lv_tmp.
    ENDIF.

    lv_tmp = server->request->get_form_field( 'periodStart' ).
    IF lv_tmp IS INITIAL.
      lv_perstr = sy-datum.
    ELSE.
      REPLACE ALL OCCURRENCES OF '-' IN lv_tmp WITH ''.
      lv_perstr = lv_tmp.
    ENDIF.

    lv_tmp = server->request->get_form_field( 'systemId' ).
    IF lv_tmp IS INITIAL.
      lv_sysid = sy-sysid.
    ELSE.
      lv_sysid = lv_tmp.
    ENDIF.

    lv_tmp = server->request->get_form_field( 'instance' ).
    IF lv_tmp IS INITIAL.
      lv_inst = 'TOTAL'.
    ELSE.
      lv_inst = lv_tmp.
    ENDIF.

    CALL FUNCTION 'SWNC_COLLECTOR_GET_AGGREGATES'
      EXPORTING
        component        = lv_inst
        assigndsys       = lv_sysid
        periodtype       = lv_pertyp
        periodstrt       = lv_perstr
        summary_only     = space
        factor           = 1000
      TABLES
        tasktype         = lt_tasktype
        tcdet            = lt_tcdet
        userworkload     = lt_users
        usertcode        = lt_usertc
        times            = lt_times
        rfcclnt          = lt_rfcclnt
        rfcsrvr          = lt_rfcsrvr
        hitlist_resptime = lt_hit_resp
        hitlist_database = lt_hit_db
      EXCEPTIONS
        no_data_found    = 1
        OTHERS           = 2.

    IF sy-subrc = 1.
      write_json( io_server = server iv_status = 404
                  iv_json = '{"error":"No ST03N aggregate data for selection"}' ).
      RETURN.
    ELSEIF sy-subrc <> 0.
      write_json( io_server = server iv_status = 500
                  iv_json = |\{"error":"SWNC_COLLECTOR_GET_AGGREGATES failed","subrc":{ sy-subrc }\}| ).
      RETURN.
    ENDIF.

    lv_json =
      |\{"query":\{"systemId":"{ escape_json( lv_sysid ) }",| &&
      |"instance":"{ escape_json( lv_inst ) }",| &&
      |"periodType":"{ escape_json( lv_pertyp ) }",| &&
      |"periodStart":"{ lv_perstr }"\},"taskTypes":[|.

    lv_first = abap_true.
    LOOP AT lt_tasktype INTO ls_tt.
      IF lv_first = abap_false.
        lv_json = lv_json && ','.
      ENDIF.
      lv_first = abap_false.
      " TASKTYPE is RAW(1) — emit hex + ST03N name
      lv_tt_x = ls_tt-tasktype.
      lv_tt_hex = lv_tt_x.
      CASE lv_tt_hex.
        WHEN '01'. lv_tt_name = 'DIALOG'.
        WHEN '02'. lv_tt_name = 'UPDATE'.
        WHEN '03'. lv_tt_name = 'SPOOL'.
        WHEN '04'. lv_tt_name = 'BACKGROUND'.
        WHEN '05'. lv_tt_name = 'ENQUEUE'.
        WHEN '06'. lv_tt_name = 'BUFFER_SYNC'.
        WHEN '07'. lv_tt_name = 'AUTOABAP'.
        WHEN '08'. lv_tt_name = 'UPDATE2'.
        WHEN '65'. lv_tt_name = 'HTTP'.
        WHEN '66'. lv_tt_name = 'HTTPS'.
        WHEN 'FE'. lv_tt_name = 'RFC'.
        WHEN 'FF'. lv_tt_name = 'CPIC'.
        WHEN OTHERS. lv_tt_name = |TYPE_{ lv_tt_hex }|.
      ENDCASE.
      lv_piece =
        |\{"taskType":"{ escape_json( lv_tt_name ) }","taskTypeCode":"{ lv_tt_hex }",| &&
        |"steps":{ ls_tt-count },"totalResponseTimeMs":{ ls_tt-respti },| &&
        |"cpuTimeMs":{ ls_tt-cputi },"queueTimeMs":{ ls_tt-queueti },| &&
        |"dbTimeMs":{ ls_tt-dbp_time }\}|.
      lv_json = lv_json && lv_piece.
    ENDLOOP.

    lv_json = lv_json && '],"transactions":['.
    lv_first = abap_true.
    lv_rows = 0.
    LOOP AT lt_tcdet INTO ls_tc.
      IF lv_rows >= lv_limit. EXIT. ENDIF.
      IF lv_first = abap_false.
        lv_json = lv_json && ','.
      ENDIF.
      lv_first = abap_false.
      lv_rows = lv_rows + 1.
      lv_piece =
        |\{"entryId":"{ escape_json( ls_tc-entry_id ) }",| &&
        |"fcode":"{ escape_json( ls_tc-fcode ) }",| &&
        |"account":"{ escape_json( ls_tc-account ) }",| &&
        |"steps":{ ls_tc-count },"totalResponseTimeMs":{ ls_tc-respti },| &&
        |"cpuTimeMs":{ ls_tc-cputi },"dbTimeMs":{ ls_tc-dbp_time }\}|.
      lv_json = lv_json && lv_piece.
    ENDLOOP.

    lv_json = lv_json && '],"users":['.
    lv_first = abap_true.
    lv_rows = 0.
    LOOP AT lt_users INTO ls_uw.
      IF lv_rows >= lv_limit. EXIT. ENDIF.
      IF lv_first = abap_false.
        lv_json = lv_json && ','.
      ENDIF.
      lv_first = abap_false.
      lv_rows = lv_rows + 1.
      " ST03N user id is usually USERNAME; ACCOUNT is often empty on S/4
      IF ls_uw-username IS NOT INITIAL.
        lv_user = ls_uw-username.
      ELSE.
        lv_user = ls_uw-account.
      ENDIF.
      lv_piece =
        |\{"user":"{ escape_json( lv_user ) }",| &&
        |"username":"{ escape_json( ls_uw-username ) }",| &&
        |"account":"{ escape_json( ls_uw-account ) }",| &&
        |"steps":{ ls_uw-count },"totalResponseTimeMs":{ ls_uw-respti },| &&
        |"cpuTimeMs":{ ls_uw-cputi }\}|.
      lv_json = lv_json && lv_piece.
    ENDLOOP.

    lv_json = lv_json && '],"userTransactions":['.
    lv_first = abap_true.
    lv_rows = 0.
    LOOP AT lt_usertc INTO ls_ut.
      IF lv_rows >= lv_limit. EXIT. ENDIF.
      IF lv_first = abap_false.
        lv_json = lv_json && ','.
      ENDIF.
      lv_first = abap_false.
      lv_rows = lv_rows + 1.
      lv_piece =
        |\{"user":"{ escape_json( ls_ut-account ) }",| &&
        |"entryId":"{ escape_json( ls_ut-entry_id ) }",| &&
        |"tcode":"{ escape_json( ls_ut-entry_id ) }",| &&
        |"steps":{ ls_ut-count },"totalResponseTimeMs":{ ls_ut-respti }\}|.
      lv_json = lv_json && lv_piece.
    ENDLOOP.

    lv_json = lv_json && '],"timeProfile":['.
    lv_first = abap_true.
    lv_rows = 0.
    LOOP AT lt_times INTO ls_tm.
      IF lv_rows >= lv_limit. EXIT. ENDIF.
      IF lv_first = abap_false.
        lv_json = lv_json && ','.
      ENDIF.
      lv_first = abap_false.
      lv_rows = lv_rows + 1.
      lv_piece =
        |\{"slot":"{ escape_json( ls_tm-time ) }",| &&
        |"steps":{ ls_tm-count },"totalResponseTimeMs":{ ls_tm-respti },| &&
        |"dbTimeMs":{ ls_tm-dbp_time }\}|.
      lv_json = lv_json && lv_piece.
    ENDLOOP.

    lv_json = lv_json && '],"rfc":['.
    lv_first = abap_true.
    lv_rows = 0.
    LOOP AT lt_rfcclnt INTO ls_rc.
      IF lv_rows >= lv_limit. EXIT. ENDIF.
      IF lv_first = abap_false.
        lv_json = lv_json && ','.
      ENDIF.
      lv_first = abap_false.
      lv_rows = lv_rows + 1.
      lv_piece =
        |\{"direction":"CLIENT","target":"{ escape_json( ls_rc-target ) }",| &&
        |"functionModule":"{ escape_json( ls_rc-func_name ) }",| &&
        |"calls":{ ls_rc-counter },"exeTimeMs":{ ls_rc-exe_time },| &&
        |"callTimeMs":{ ls_rc-call_time }\}|.
      lv_json = lv_json && lv_piece.
    ENDLOOP.
    LOOP AT lt_rfcsrvr INTO ls_rs.
      IF lv_rows >= lv_limit. EXIT. ENDIF.
      IF lv_first = abap_false.
        lv_json = lv_json && ','.
      ENDIF.
      lv_first = abap_false.
      lv_rows = lv_rows + 1.
      lv_piece =
        |\{"direction":"SERVER","target":"{ escape_json( ls_rs-target ) }",| &&
        |"functionModule":"{ escape_json( ls_rs-func_name ) }",| &&
        |"calls":{ ls_rs-counter },"exeTimeMs":{ ls_rs-exe_time },| &&
        |"callTimeMs":{ ls_rs-call_time }\}|.
      lv_json = lv_json && lv_piece.
    ENDLOOP.

    lv_json = lv_json && '],"hitlistResponse":['.
    lv_first = abap_true.
    lv_rows = 0.
    LOOP AT lt_hit_resp INTO ls_h.
      IF lv_rows >= 100. EXIT. ENDIF.
      IF lv_first = abap_false.
        lv_json = lv_json && ','.
      ENDIF.
      lv_first = abap_false.
      lv_rows = lv_rows + 1.
      lv_piece =
        |\{"user":"{ escape_json( ls_h-account ) }",| &&
        |"tcode":"{ escape_json( ls_h-tcode ) }",| &&
        |"report":"{ escape_json( ls_h-report ) }",| &&
        |"responseTimeMs":{ ls_h-respti },"dbTimeMs":{ ls_h-dbp_time },| &&
        |"cpuTimeMs":{ ls_h-cputi }\}|.
      lv_json = lv_json && lv_piece.
    ENDLOOP.

    lv_json = lv_json && '],"hitlistDatabase":['.
    lv_first = abap_true.
    lv_rows = 0.
    LOOP AT lt_hit_db INTO ls_h.
      IF lv_rows >= 100. EXIT. ENDIF.
      IF lv_first = abap_false.
        lv_json = lv_json && ','.
      ENDIF.
      lv_first = abap_false.
      lv_rows = lv_rows + 1.
      lv_piece =
        |\{"user":"{ escape_json( ls_h-account ) }",| &&
        |"tcode":"{ escape_json( ls_h-tcode ) }",| &&
        |"report":"{ escape_json( ls_h-report ) }",| &&
        |"responseTimeMs":{ ls_h-respti },"dbTimeMs":{ ls_h-dbp_time },| &&
        |"cpuTimeMs":{ ls_h-cputi }\}|.
      lv_json = lv_json && lv_piece.
    ENDLOOP.

    lv_json = lv_json && |],"meta":\{"source":"SWNC_COLLECTOR_GET_AGGREGATES",| &&
      |"userCount":{ lines( lt_users ) },| &&
      |"userTcodeCount":{ lines( lt_usertc ) },| &&
      |"timeSlotCount":{ lines( lt_times ) },| &&
      |"rfcClientCount":{ lines( lt_rfcclnt ) },| &&
      |"rfcServerCount":{ lines( lt_rfcsrvr ) },| &&
      |"hitlistRespCount":{ lines( lt_hit_resp ) },| &&
      |"hitlistDbCount":{ lines( lt_hit_db ) }\}\}|.

    write_json( io_server = server iv_status = 200 iv_json = lv_json ).
  ENDMETHOD.


  METHOD write_json.
    DATA lv_reason TYPE string.
    CASE iv_status.
      WHEN 200. lv_reason = 'OK'.
      WHEN 404. lv_reason = 'Not Found'.
      WHEN 405. lv_reason = 'Method Not Allowed'.
      WHEN OTHERS. lv_reason = 'Error'.
    ENDCASE.

    io_server->response->set_status( code = iv_status reason = lv_reason ).
    io_server->response->set_header_field(
      name = 'Content-Type' value = 'application/json; charset=utf-8' ).
    io_server->response->set_header_field(
      name = 'Cache-Control' value = 'no-store' ).
    io_server->response->set_cdata( data = iv_json ).
  ENDMETHOD.


  METHOD escape_json.
    rv_value = iv_value.
    REPLACE ALL OCCURRENCES OF '\' IN rv_value WITH '\\'.
    REPLACE ALL OCCURRENCES OF '"' IN rv_value WITH '\"'.
    REPLACE ALL OCCURRENCES OF cl_abap_char_utilities=>newline IN rv_value WITH '\n'.
  ENDMETHOD.

ENDCLASS.
