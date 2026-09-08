*&---------------------------------------------------------------------*
*& Report  ZST03N_EXTRACT
*&---------------------------------------------------------------------*
*& Extract SAP workload / usage statistics (ST03N aggregates) to CSV.
*&
*& Why this exists:
*&   ST03N (Workload Monitor) can export the currently displayed ALV to a
*&   spreadsheet interactively (List → Export / spreadsheet icon). That is
*&   not a scheduled bulk extract API. For automation, call the SWNC
*&   collector interface (SAP Note 1053634) — same data ST03N shows.
*&
*& Source FM: SWNC_COLLECTOR_GET_AGGREGATES
*& Alternative frame API: SWNC_GET_AGGREGATES_FRAME (SCSM_NW_WORKLOAD)
*&
*& Install: create executable program ZST03N_EXTRACT in SE38 and paste.
*& Tested conceptually against SAP_BASIS 7.5x+; adjust structure field
*& names if your release differs (SE11 → SWNCAGGTASKTYPE etc.).
*&---------------------------------------------------------------------*
REPORT zst03n_extract.

TYPE-POOLS: abap.

SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE text-001.
PARAMETERS:
  p_comp   TYPE swnchostname DEFAULT 'TOTAL' OBLIGATORY, " Instance / TOTAL
  p_sysid  TYPE swncsysid    DEFAULT sy-sysid,
  p_pertyp TYPE swncperitype DEFAULT 'D' OBLIGATORY,     " D/W/M
  p_perstr TYPE swncdatum    DEFAULT sy-datum OBLIGATORY,
  p_factor TYPE swncdivfactor DEFAULT 1000.               " times in ms
SELECTION-SCREEN END OF BLOCK b1.

SELECTION-SCREEN BEGIN OF BLOCK b2 WITH FRAME TITLE text-002.
PARAMETERS:
  p_task  AS CHECKBOX DEFAULT 'X', " TASKTYPE
  p_tc    AS CHECKBOX DEFAULT 'X', " TCDET
  p_uw    AS CHECKBOX DEFAULT 'X', " USERWORKLOAD
  p_ut    AS CHECKBOX DEFAULT 'X', " USERTCODE
  p_time  AS CHECKBOX DEFAULT 'X', " TIMES
  p_rfc   AS CHECKBOX DEFAULT 'X', " RFCCLNT + RFCSRVR
  p_hit   AS CHECKBOX DEFAULT 'X'. " HITLIST_*
SELECTION-SCREEN END OF BLOCK b2.

SELECTION-SCREEN BEGIN OF BLOCK b3 WITH FRAME TITLE text-003.
PARAMETERS:
  p_pres  RADIOBUTTON GROUP out DEFAULT 'X', " Presentation server (GUI)
  p_apps  RADIOBUTTON GROUP out,             " Application server
  p_path  TYPE rlgrap-filename
            DEFAULT 'C:\temp\st03n_extract'. " Base path / filename prefix
  p_alv   AS CHECKBOX DEFAULT 'X'.           " Also show TASKTYPE ALV
SELECTION-SCREEN END OF BLOCK b3.

* Aggregates (subset of SWNC_COLLECTOR_GET_AGGREGATES tables)
DATA:
  gt_tasktype      TYPE TABLE OF swncaggtasktype,
  gt_tcdet         TYPE TABLE OF swncaggtcdet,
  gt_userworkload  TYPE TABLE OF swncagguserworkload,
  gt_usertcode     TYPE TABLE OF swncaggusertcode,
  gt_times         TYPE TABLE OF swncaggtimes,
  gt_rfcclnt       TYPE TABLE OF swncaggrfcclnt,
  gt_rfcsrvr       TYPE TABLE OF swncaggrfcsrvr,
  gt_hit_resp      TYPE TABLE OF swnchitlist,
  gt_hit_db        TYPE TABLE OF swnchitlist.

DATA: gv_msg TYPE string.

START-OF-SELECTION.
  PERFORM extract_aggregates.
  IF p_task = abap_true.
    PERFORM write_csv_tasktype.
  ENDIF.
  IF p_tc = abap_true.
    PERFORM write_csv_tcdet.
  ENDIF.
  IF p_uw = abap_true.
    PERFORM write_csv_userworkload.
  ENDIF.
  IF p_ut = abap_true.
    PERFORM write_csv_usertcode.
  ENDIF.
  IF p_time = abap_true.
    PERFORM write_csv_times.
  ENDIF.
  IF p_rfc = abap_true.
    PERFORM write_csv_rfc.
  ENDIF.
  IF p_hit = abap_true.
    PERFORM write_csv_hitlists.
  ENDIF.
  IF p_alv = abap_true.
    PERFORM show_alv_tasktype.
  ENDIF.

*&---------------------------------------------------------------------*
*&      Form EXTRACT_AGGREGATES
*&---------------------------------------------------------------------*
FORM extract_aggregates.
  CALL FUNCTION 'SWNC_COLLECTOR_GET_AGGREGATES'
    EXPORTING
      component     = p_comp
      assigndsys    = p_sysid
      periodtype    = p_pertyp
      periodstrt    = p_perstr
      summary_only  = space
      factor        = p_factor
    TABLES
      tasktype      = gt_tasktype
      tcdet         = gt_tcdet
      userworkload  = gt_userworkload
      usertcode     = gt_usertcode
      times         = gt_times
      rfcclnt       = gt_rfcclnt
      rfcsrvr       = gt_rfcsrvr
      hitlist_resptime = gt_hit_resp
      hitlist_database = gt_hit_db
    EXCEPTIONS
      no_data_found = 1
      OTHERS        = 2.

  IF sy-subrc = 1.
    MESSAGE i000(db) WITH 'No ST03N aggregate data found for selection.'.
  ELSEIF sy-subrc <> 0.
    MESSAGE e000(db) WITH 'SWNC_COLLECTOR_GET_AGGREGATES failed' sy-subrc.
  ENDIF.
ENDFORM.

*&---------------------------------------------------------------------*
*&      Form WRITE_LINES  — presentation or app server
*&---------------------------------------------------------------------*
FORM write_lines USING iv_suffix TYPE string
                       it_lines  TYPE stringtab.
  DATA: lv_file TYPE string,
        lv_path TYPE string.

  lv_path = p_path.
  CONCATENATE lv_path '_' iv_suffix '.csv' INTO lv_file.

  IF p_pres = abap_true.
    " it_lines already contains full CSV rows (header + data)
    CALL FUNCTION 'GUI_DOWNLOAD'
      EXPORTING
        filename = lv_file
        filetype = 'ASC'
      TABLES
        data_tab = it_lines
      EXCEPTIONS
        OTHERS   = 1.
    IF sy-subrc = 0.
      CONCATENATE 'Downloaded' lv_file INTO gv_msg SEPARATED BY space.
      MESSAGE s000(db) WITH gv_msg.
    ELSE.
      MESSAGE e000(db) WITH 'GUI_DOWNLOAD failed for' lv_file.
    ENDIF.
  ELSE.
    OPEN DATASET lv_file FOR OUTPUT IN TEXT MODE ENCODING UTF-8.
    IF sy-subrc <> 0.
      MESSAGE e000(db) WITH 'Cannot open dataset' lv_file.
    ENDIF.
    LOOP AT it_lines INTO DATA(lv_line).
      TRANSFER lv_line TO lv_file.
    ENDLOOP.
    CLOSE DATASET lv_file.
    CONCATENATE 'Wrote app-server file' lv_file INTO gv_msg SEPARATED BY space.
    MESSAGE s000(db) WITH gv_msg.
  ENDIF.
ENDFORM.

*&---------------------------------------------------------------------*
*& CSV helpers — keep headers stable for Node.js / BI consumers
*& Field names follow common SWNCAGG* layouts; verify on your system.
*&---------------------------------------------------------------------*
FORM write_csv_tasktype.
  DATA: lt TYPE stringtab,
        lv TYPE string,
        ls TYPE swncaggtasktype.

  APPEND 'TASKTYPE,COUNT,RESPTI,PROCTI,CPUTI,DBTI,WAITTI,ROLLWAITTI,GUITIME' TO lt.
  LOOP AT gt_tasktype INTO ls.
    " Adjust component names via SE11 if activation fails on your release
    lv = |{ ls-tasktype },{ ls-count },{ ls-respti },{ ls-procti },{ ls-cputi },{ ls-dbti },{ ls-waitti },{ ls-rollwaitti },{ ls-guitime }|.
    APPEND lv TO lt.
  ENDLOOP.
  PERFORM write_lines USING 'tasktype' lt.
ENDFORM.

FORM write_csv_tcdet.
  DATA: lt TYPE stringtab,
        lv TYPE string,
        ls TYPE swncaggtcdet.

  APPEND 'ENTRY_ID,TCODE,ACCOUNT,COUNT,RESPTI,PROCTI,CPUTI,DBTI' TO lt.
  LOOP AT gt_tcdet INTO ls.
    lv = |{ ls-entry_id },{ ls-tcode },{ ls-account },{ ls-count },{ ls-respti },{ ls-procti },{ ls-cputi },{ ls-dbti }|.
    APPEND lv TO lt.
  ENDLOOP.
  PERFORM write_lines USING 'tcdet' lt.
ENDFORM.

FORM write_csv_userworkload.
  DATA: lt TYPE stringtab,
        lv TYPE string,
        ls TYPE swncagguserworkload.

  APPEND 'ACCOUNT,COUNT,RESPTI,PROCTI,CPUTI,DBTI' TO lt.
  LOOP AT gt_userworkload INTO ls.
    lv = |{ ls-account },{ ls-count },{ ls-respti },{ ls-procti },{ ls-cputi },{ ls-dbti }|.
    APPEND lv TO lt.
  ENDLOOP.
  PERFORM write_lines USING 'userworkload' lt.
ENDFORM.

FORM write_csv_usertcode.
  DATA: lt TYPE stringtab,
        lv TYPE string,
        ls TYPE swncaggusertcode.

  APPEND 'ACCOUNT,ENTRY_ID,TCODE,COUNT,RESPTI,PROCTI,CPUTI,DBTI' TO lt.
  LOOP AT gt_usertcode INTO ls.
    lv = |{ ls-account },{ ls-entry_id },{ ls-tcode },{ ls-count },{ ls-respti },{ ls-procti },{ ls-cputi },{ ls-dbti }|.
    APPEND lv TO lt.
  ENDLOOP.
  PERFORM write_lines USING 'usertcode' lt.
ENDFORM.

FORM write_csv_times.
  DATA: lt TYPE stringtab,
        lv TYPE string,
        ls TYPE swncaggtimes.

  APPEND 'TIMESLOT,COUNT,RESPTI,PROCTI,CPUTI,DBTI' TO lt.
  LOOP AT gt_times INTO ls.
    lv = |{ ls-timeslot },{ ls-count },{ ls-respti },{ ls-procti },{ ls-cputi },{ ls-dbti }|.
    APPEND lv TO lt.
  ENDLOOP.
  PERFORM write_lines USING 'times' lt.
ENDFORM.

FORM write_csv_rfc.
  DATA: lt TYPE stringtab,
        lv TYPE string,
        ls_c TYPE swncaggrfcclnt,
        ls_s TYPE swncaggrfcsrvr.

  APPEND 'DIRECTION,DESTINATION,FUNCNAME,COUNT,EXETI,CALL_TIME' TO lt.
  LOOP AT gt_rfcclnt INTO ls_c.
    lv = |CLIENT,{ ls_c-destination },{ ls_c-funcname },{ ls_c-count },{ ls_c-exeti },{ ls_c-call_time }|.
    APPEND lv TO lt.
  ENDLOOP.
  LOOP AT gt_rfcsrvr INTO ls_s.
    lv = |SERVER,{ ls_s-destination },{ ls_s-funcname },{ ls_s-count },{ ls_s-exeti },{ ls_s-call_time }|.
    APPEND lv TO lt.
  ENDLOOP.
  PERFORM write_lines USING 'rfc' lt.
ENDFORM.

FORM write_csv_hitlists.
  DATA: lt TYPE stringtab,
        lv TYPE string,
        ls TYPE swnchitlist.

  APPEND 'KIND,ACCOUNT,TCODE,REPORT,RESPTI,DBTI,CPUTI,ENDTIME' TO lt.
  LOOP AT gt_hit_resp INTO ls.
    lv = |RESPTIME,{ ls-account },{ ls-tcode },{ ls-report },{ ls-respti },{ ls-dbti },{ ls-cputi },{ ls-endtime }|.
    APPEND lv TO lt.
  ENDLOOP.
  PERFORM write_lines USING 'hitlist_resptime' lt.

  CLEAR lt.
  APPEND 'KIND,ACCOUNT,TCODE,REPORT,RESPTI,DBTI,CPUTI,ENDTIME' TO lt.
  LOOP AT gt_hit_db INTO ls.
    lv = |DATABASE,{ ls-account },{ ls-tcode },{ ls-report },{ ls-respti },{ ls-dbti },{ ls-cputi },{ ls-endtime }|.
    APPEND lv TO lt.
  ENDLOOP.
  PERFORM write_lines USING 'hitlist_database' lt.
ENDFORM.

*&---------------------------------------------------------------------*
*&      Form SHOW_ALV_TASKTYPE
*&---------------------------------------------------------------------*
FORM show_alv_tasktype.
  DATA: lo_alv TYPE REF TO cl_salv_table.

  CHECK gt_tasktype IS NOT INITIAL.
  TRY.
      cl_salv_table=>factory(
        IMPORTING r_salv_table = lo_alv
        CHANGING  t_table      = gt_tasktype ).
      lo_alv->get_functions( )->set_all( abap_true ).
      lo_alv->display( ).
    CATCH cx_salv_msg INTO DATA(lx).
      MESSAGE lx TYPE 'I'.
  ENDTRY.
ENDFORM.

* Selection texts (maintain in SE38 → Text elements, or use literals above):
* text-001 = Period / instance
* text-002 = Aggregates to extract
* text-003 = Output
