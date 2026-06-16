<?php
require __DIR__.'/../includes/auth.php';
session_destroy();
header('Location: /admin');
exit;
?>
