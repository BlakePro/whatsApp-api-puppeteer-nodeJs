<?php
$filename = 'results.json';
if(file_exists($filename)){
  $json = json_decode(file_get_contents($filename), TRUE);
  echo '<pre>'.print_r($json, TRUE).'</pre>';
}
