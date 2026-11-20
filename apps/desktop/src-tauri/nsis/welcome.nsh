!define WEMD_WELCOME_IMAGE "${__FILEDIR__}\welcome.bmp"

!macro WeMDWelcomeFunctions
  Var WeMDWelcomeBitmap

  Function WeMDWelcomeShow
    InitPluginsDir
    File /oname=$PLUGINSDIR\wemd-welcome.bmp "${WEMD_WELCOME_IMAGE}"

    ${NSD_CreateBitmap} 0 0 100% 100% ""
    Pop $0
    ${NSD_SetStretchedBitmap} $0 "$PLUGINSDIR\wemd-welcome.bmp" $WeMDWelcomeBitmap
    ${If} $WeMDWelcomeBitmap P<> 0
      ShowWindow $mui.WelcomePage.Image ${SW_HIDE}
      ShowWindow $mui.WelcomePage.Title ${SW_HIDE}
      ShowWindow $mui.WelcomePage.Text ${SW_HIDE}
    ${Else}
      ShowWindow $0 ${SW_HIDE}
    ${EndIf}
  FunctionEnd

  Function WeMDWelcomeDestroyed
    ${NSD_FreeBitmap} $WeMDWelcomeBitmap
  FunctionEnd
!macroend
