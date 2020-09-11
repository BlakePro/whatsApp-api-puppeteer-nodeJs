<?php
$data = file_get_contents('php://input');
$response = [];
if($data != ''){

  //FROM WHATSAPP API
  $array = json_decode($data, TRUE);
  if(is_array($array) && !empty($array)){
    $body = array_key_exists('body', $array) ? $array['body'] : null; // body of message
    $type = array_key_exists('type', $array) ? $array['type'] : null; // type of message
    $from = array_key_exists('from', $array) ? preg_replace('~\D~', '', $array['from']) : null; // from
    $to = array_key_exists('to', $array) ? preg_replace('~\D~', '', $array['to']) : null; // to

    $type_response = 'message';

    //SEND | MESSAGE | $type_response = 'message';
    $message = "Hello {$type} {$from}";

    //SEND | LOCATION | $type_response = 'media';
    $args = [
      'location' => [
        'latitude' => '23.3848867',
        'longitude' => '-111.582129',
        'name' => 'Named Location'
      ]
    ];
    //$message = json_encode($args, TRUE);

    //SEND | FILE (PDF, JPG, PNG, DOCX, ...) | $type_response = 'media';
    $file = 'jpgFile.jpg';
    $file = 'pdfFile.pdf';
    $file = 'pngFile.png';
    $file_mimetype = mime_content_type($file);
    $file_content = base64_encode(file_get_contents($file));
    $attachment = "data:{$file_mimetype};base64,{$file_content}";
    $args = [
      'caption' => 'Named File',
      'attachment' => $attachment
    ];
    //$message = json_encode($args, TRUE);

    //TO WHATSAPP BOT
    $response = [
      'status' => TRUE,
      'type' => $type_response,
      'message' => $message
    ];
  }
}
header('Content-Type: application/json');
echo json_encode($response, TRUE);
