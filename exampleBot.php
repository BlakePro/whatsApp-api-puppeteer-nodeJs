<?php
$data = file_get_contents('php://input');
$response = [];
if($data != ''){

  $path_file = 'mediaBot/';

  //FROM WHATSAPP API
  $array = json_decode($data, TRUE);
  if(is_array($array) && !empty($array)){

    $body = array_key_exists('body', $array) ? $array['body'] : null; // body of message
    $type = array_key_exists('type', $array) ? $array['type'] : null; // type of message
    $from = array_key_exists('from', $array) ? preg_replace('~\D~', '', $array['from']) : null; // from
    $to = array_key_exists('to', $array) ? preg_replace('~\D~', '', $array['to']) : null; // to

    //DEFAULT MESSAGE
    $caption = "Hello {$type} {$from}";

    //EXAMPLE SEND | LOCATION
    /*
      $args = [
        'location' => [
          'latitude' => '23.3848867',
          'longitude' => '-111.582129',
          'name' => $caption
        ]
      ];
      $type_response = 'media';
      $message = json_encode($args, TRUE);
    */

    //EXAMPLE SEND | PREVIEW LINK
    /*
      $args = [
        'content' => "https://github.com {$caption}",
        'preview' => TRUE
      ];
      $type_response = 'media';
      $message = json_encode($args, TRUE);
    */

    //EXAMPLE SEND | FILE (PDF, JPG, PNG, DOCX, STICKER/WEBP)
    /*
      $array_file = ['jpgFile.jpg', 'pdfFile.pdf', 'pngFile.png', 'wordFile.docx', 'stickerFile.webp'];
      $file = $path_file.$array_file[0];
      $file_mimetype = mime_content_type($file);
      $file_content = base64_encode(file_get_contents($file));
      $attachment = "data:{$file_mimetype};base64,{$file_content}";
      $args = [
        'caption' => $caption,
        'attachment' => $attachment
      ];
      $type_response = 'media';
      $message = json_encode($args, TRUE);
    */


    //EXAMPLE SEND | SINGLE MESSAGE

      $message = $caption;
      $type_response = 'message';
  

    //EXAMPLE SEND | MULTIPLE MESSAGE
    /*
      $message = [$caption, $caption];
      $type_response = 'message';
    */

    //SEND TO WHATSAPP
    $response = [
      'status' => TRUE,
      'type' => $type_response,
      'message' => $message
    ];
  }
}

//RETURN JSON
header('Content-Type: application/json');
echo json_encode($response, TRUE);
