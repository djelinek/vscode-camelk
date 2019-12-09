from('timer:tick?period=3s')
	.setBody().constant('Hello uitests!')
	.to('log:info')