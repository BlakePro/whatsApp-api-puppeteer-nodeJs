<?php
$file_get = file_get_contents('php://input');
$response = [];
if($file_get != ''){
  $array_data = json_decode($file_get, TRUE);
  if(is_array($array_data) && !empty($array_data)){
    $data = array_key_exists('data', $array_data) ? $array_data['data'] : [];
    $type = array_key_exists('type', $data) ? $data['type'] : '';
    if($type != ''){
      if(!in_array($type, ['chat', 'location', 'vcard']) && array_key_exists('body', $data))$array_data['data']['body'] = '';

      $filename = 'results.json';
      if(!file_exists($filename)){
        $file = fopen($filename, 'w');
        fwrite($file, '[]');
        fclose($file);
      }

      $json = json_decode(file_get_contents($filename), TRUE);
      array_push($json, $array_data);
      file_put_contents($filename, json_encode($json));
    }
  }
}
