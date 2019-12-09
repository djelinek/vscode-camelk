function proc(e) {
    e.getIn().setBody('Hello uitests!')
}

from('timer:tick')
    .process(proc)
    .to('log:info')